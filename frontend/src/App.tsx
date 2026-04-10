import { SignedIn, SignedOut, RedirectToSignIn} from "@clerk/clerk-react"
import { Routes, Route, Form } from 'react-router-dom'
import HomePage from "./pages/HomePage"
import SinginPage from "./pages/SinginPage"
import SingupPage from "./pages/SingupPage"
import DashboardPage from "./pages/DashboardPage"
import PricingPage from "./pages/PricingPage"
import Layout from "./components/Layout"

const ProtectedRoute = ({children}:{children: any}) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

function App() {


  return (
    <Routes>
      <Route path="/" element={<Layout/>}>
        <Route index element={<HomePage/>} />
          <Route path={"sign-in/*"} element={<SinginPage/>} />
          <Route path={"sign-up/*"} element={<SingupPage/>} />
          <Route path={"pricing"} element={<PricingPage/>} />
          <Route
            path={"dashboard"}
            element={
              <ProtectedRoute>
                <DashboardPage/>
              </ProtectedRoute>
            }
          />
      </Route>
    </Routes>
  )
}

export default App