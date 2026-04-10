import { Outlet, Link } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, OrganizationSwitcher, useOrganization } from "@clerk/clerk-react";
import ThemeToggle from "./ThemeToggle";
import useTheme from "../hooks/useTheme";


const Layout = () => {
    const {organization} = useOrganization()
    const { theme } = useTheme();

    const isDark = theme === 'dark';

    return (
        <div className={"layout"}>
            <div className={"nav"}>
                <div className={"nav-container"}>

                    <Link to={"/"} className={"nav-logo"}>
                        TaskBorad
                    </Link>

                    <div className={"nav-links"}>
                        <Link to={"/pricing"} className={"nav-link"}>
                            Pricing
                        </Link>

                        <SignedOut>
                            <Link to={"/sign-in"} className={"nav-link"}>
                                Sign in
                            </Link>
                            <Link to={"/sign-up"} className={"btn btn-primary"}>
                                Sign up
                            </Link>
                        </SignedOut>

                        <SignedIn>
                            <OrganizationSwitcher
                                hidePersonal
                                afterCreateOrganizationUrl={"dashboard"}
                                afterSelectOrganizationUrl={"dashboard"}
                                createOrganizationMode={"modal"}
                                appearance={{
                                    elements: {
                                        organizationSwitcherTrigger: {
                                            backgroundColor: isDark ? "rgba(30, 41, 59, 0.9)" : "rgba(255, 255, 255, 0.9)",
                                            border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
                                            borderRadius: "8px",
                                            padding: "6px 12px",
                                            color: isDark ? "#f8fafc" : "#0f172a",
                                            fontWeight: "500",
                                        },
                                        organizationPreviewText: {
                                            color: isDark ? "#f8fafc" : "#0f172a",
                                            fontWeight: "500",
                                        },
                                        organizationSwitcherTriggerIcon: {
                                            color: isDark ? "#94a3b8" : "#475569",
                                        },
                                        organizationPreviewSecondaryIdentifier: {
                                            color: isDark ? "#64748b" : "#64748b",
                                        }
                                    }
                                }}
                            />
                            {organization &&
                            <Link to={"/dashboard"} className={"nav-link"}>
                                Dashboard
                            </Link>
                            }
                            <ThemeToggle />
                            <UserButton/>
                        </SignedIn>
                        
                    </div>
                </div>
            </div>

            <main>
                <Outlet/>
            </main>

        </div>
    )
}

export default Layout