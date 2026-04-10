import json
from sys import prefix
from fastapi import APIRouter, Request, HTTPException, status
from svix.webhooks import Webhook, WebhookVerificationError
from app.core.config import settings
from app.core.clerk import clerk

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

PRO_TIER_SLUG = "pro_tier"
FREE_TIER_LIMIT = settings.FREE_TIER_MEMBERSHIP_LIMIT
ULIMITED = 1000000

def set_org_member_limit(org_id: str, limit:int):
    clerk.organizations.update(
        organization_id=org_id,
        max_allowed_memberships=limit
    )

def has_active_pro_plan(items:list) -> bool:
    return any(
        item.get("plan", {}).get("slug") == PRO_TIER_SLUG
        and item.get("status") == "active"
        for item in items
    )

@router.post("/clerk")
async def clerk_webhook(request: Request):
    payload = await request.body()
    headers = dict(request.headers)

    if settings.CLERK_WEBHOOK_SECRET:
        try:
            wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
            event = wh.verify(payload, headers)
        except WebhookVerificationError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature")
    else:
        event = json.loads(payload)

    event_type = event.get("type")
    data = event.get("data", {})

    print(f"Received webhook: {event_type}")
    print(f"Data: {data}")

    if event_type in ["subscription.created", "subscription.updated"]:
        try:
            org_id = data["payer"]["organization_id"]
        except (KeyError, TypeError):
            org_id = None

        if org_id is None and hasattr(data, "payer"):
            payer = data.payer
            if hasattr(payer, "orgnization_id"):
                org_id = payer.organization_id
            elif isinstance(payer, dict):
                org_id = payer.get("orgnization_id")

        print(f'Org ID:{org_id}')
        print(f'Data type:{type(data)}')
        print(f'Payer type:{type(data.get('payer'))}')

        if org_id:
            has_pro = has_active_pro_plan(data.get("items", []))
            limit = (ULIMITED if has_pro else FREE_TIER_LIMIT)
            print(f"Setting limit to {limit} (has_pro={has_pro})")
            set_org_member_limit(org_id, limit)

    elif event_type in ["subscription.deleted", "subscription.cancelled"]:
        try:
            org_id = data["payer"]["organization_id"]
        except (KeyError, TypeError):
            org_id = None

        if org_id is None and hasattr(data, "payer"):
            payer = data.payer
            if hasattr(payer, "orgnization_id"):
                org_id = payer.organization_id
            elif isinstance(payer, dict):
                org_id = payer.get("orgnization_id")
                
        print(f"Resetting limit for org: {org_id}")
        if org_id:
            set_org_member_limit(org_id, FREE_TIER_LIMIT)
    
    return {"received":True}