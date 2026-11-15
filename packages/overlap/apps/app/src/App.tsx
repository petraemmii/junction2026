import { StoreProvider, useStore } from './lib/store'
import { Login, Loading, RoleSelect } from './screens/Auth'
import { EventDetail, Home } from './screens/Events'
import { Overview } from './screens/Overview'
import { Questionnaire } from './screens/Questionnaire'
import { Results } from './screens/Results'
import { SettingsScreen } from './screens/Settings'
import { Shortlist } from './screens/Shortlist'

function Router() {
  const { route, role, r } = useStore()
  switch (route.name) {
    case 'loading':
      return <Loading />
    case 'login':
      return <Login />
    case 'role':
      return <RoleSelect />
    case 'event':
      return <EventDetail id={route.id} />
    case 'quiz':
      return <Questionnaire />
    case 'results':
      return <Results />
    case 'settings':
      return <SettingsScreen />
    case 'shortlist':
      return r === 'company' && role ? <Shortlist /> : <Home />
    case 'overview':
      return r === 'company' && role ? <Overview /> : <Home />
    default:
      return <Home />
  }
}
export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
