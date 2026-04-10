import { useOrganization } from "@clerk/clerk-react"
import { PricingTable, CreateOrganization } from "@clerk/clerk-react"

const PricingPage = () => {
    const {organization, membership} = useOrganization()
    const isAdmin = membership?.role === "org:admin"

    // 如果用户没有加入任何组织，则显示下面的UI
    if (!organization) {
        return (
            <div className="pricing-container">
                <div className="on-org-container">
                    <h1 className="no-org-title">View Pricing</h1>
                    <p className="no-org-text">
                        Create or join an organization to view pricing plans.
                    </p>
                    <CreateOrganization afterCreateOrganizationUrl={"/pricing"}/>
                </div>
            </div>
        )
    }

    return (
        <div className="pricing-container">
            <div className="pricing-header">
                <h1 className="pricing-title">Simple, Transparent Pricing</h1>
                <p>
                    Start free with up to 2 members, Upgrade to pro for unlimited members.
                </p>
            </div>

            {!isAdmin ? (
                <p className="text-muted pricing-admin-note">
                    Contact your organizations admin for manage the subscription.
                </p>
            ):(
                <PricingTable for="organization"/>
            )
            }
        </div>
    )
}

export default PricingPage