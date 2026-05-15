/* Admin Analytics Dashboard */
import AdminDashboard from './AdminDashboard'

export const metadata = {
  title: 'Admin Dashboard | RingIn',
  description: 'RingIn admin analytics',
  robots: { index: false, follow: false },  // Don't index admin pages!
}

export default function AdminPage() {
  return <AdminDashboard />
}
