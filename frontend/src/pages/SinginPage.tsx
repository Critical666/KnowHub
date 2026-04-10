import { SignIn } from "@clerk/clerk-react"

const SinginPage = () => {
    return (
        <div className={"auth-container"}>
            <SignIn 
                routing={"path"}
                path={"/sign-in"}
                signUpUrl={"/sign-up"}    
            />
        </div>
    )
}

export default SinginPage