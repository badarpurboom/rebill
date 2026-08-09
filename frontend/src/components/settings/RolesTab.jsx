import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useToast } from '@/context/ToastContext'
import { roles, users } from '@/services/auth'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { PageLoader, Badge } from '@/components/ui/Misc'

const PERMISSIONS_LIST = [
  { id: 'view_dashboard', label: 'View Dashboard' },
  { id: 'view_pos', label: 'View Billing POS' },
  { id: 'view_floor_map', label: 'View Floor Map' },
  { id: 'view_kot', label: 'View KOT Display' },
  { id: 'view_menu', label: 'View Menu Catalog' },
  { id: 'view_customers', label: 'View Customers' },
  { id: 'view_orders', label: 'View Order History' },
  { id: 'view_whatsapp', label: 'View WhatsApp' },
  { id: 'view_coupons', label: 'View Coupons' },
  { id: 'view_reports', label: 'View Reports' },
  { id: 'view_settings', label: 'View Settings' },
  { id: 'punch_order', label: 'Punch Order' },
  { id: 'print_kot', label: 'Print KOT' },
  { id: 'print_bill', label: 'Print Bill' },
  { id: 'settle_bill', label: 'Settle Bill (Pay)' },
  { id: 'cancel_bill', label: 'Cancel/Void Bill' },
  { id: 'owner_override', label: 'Owner Override (High Limits)' },
]

export default function RolesTab() {
  const toast = useToast()
  const [roleList, setRoleList] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeSubTab, setActiveSubTab] = useState('roles') // 'roles' | 'users'

  // Role Form
  const [editingRole, setEditingRole] = useState(null)
  const { register: registerRole, handleSubmit: handleRoleSubmit, reset: resetRole, setValue: setRoleValue, watch: watchRole } = useForm()

  // User Form
  const [editingUser, setEditingUser] = useState(null)
  const { register: registerUser, handleSubmit: handleUserSubmit, reset: resetUser } = useForm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rData, uData] = await Promise.all([roles.list(), users.list()])
      setRoleList(rData)
      setUserList(uData)
    } catch (err) {
      toast.error('Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  // --- Role Handlers ---
  const onEditRole = (role) => {
    setEditingRole(role)
    resetRole({
      name: role.name,
      permissions: role.permissions,
    })
  }
  const onNewRole = () => {
    setEditingRole({ id: 'new', is_system: false })
    resetRole({ name: '', permissions: {} })
  }
  const saveRole = async (data) => {
    try {
      if (editingRole.id === 'new') {
        await roles.create(data)
        toast.success('Role created!')
      } else {
        await roles.update(editingRole.id, data)
        toast.success('Role updated!')
      }
      setEditingRole(null)
      fetchData()
    } catch (err) {
      toast.error('Failed to save role.')
    }
  }
  const deleteRole = async (id) => {
    if (!window.confirm('Delete this role?')) return
    try {
      await roles.remove(id)
      toast.success('Role deleted.')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot delete role.')
    }
  }

  // --- User Handlers ---
  const onEditUser = (user) => {
    setEditingUser(user)
    resetUser({
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      custom_role: user.custom_role?.id || '',
      is_active: user.is_active,
    })
  }
  const onNewUser = () => {
    setEditingUser({ id: 'new' })
    resetUser({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      custom_role: '',
      is_active: true,
    })
  }
  const saveUser = async (data) => {
    try {
      // Clean up empty password
      if (!data.password) delete data.password
      if (data.custom_role === '') data.custom_role = null

      if (editingUser.id === 'new') {
        await users.create(data)
        toast.success('Staff member created!')
      } else {
        await users.update(editingUser.id, data)
        toast.success('Staff updated!')
      }
      setEditingUser(null)
      fetchData()
    } catch (err) {
      toast.error('Failed to save staff.')
    }
  }

  if (loading) return <PageLoader label="Loading..." />

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSubTab('roles')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition ${activeSubTab === 'roles' ? 'bg-slate-900 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
        >
          Manage Roles
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition ${activeSubTab === 'users' ? 'bg-slate-900 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
        >
          Manage Staff Users
        </button>
      </div>

      {activeSubTab === 'roles' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-slate-900">Custom Roles & Permissions</h2>
            {!editingRole && (
              <Button onClick={onNewRole} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                + Create Role
              </Button>
            )}
          </div>

          {editingRole ? (
            <form onSubmit={handleRoleSubmit(saveRole)} className="space-y-4">
              <FormRow label="Role Name" required>
                <Input
                  className="rounded-xl font-bold"
                  {...registerRole('name', { required: true })}
                  disabled={editingRole.is_system}
                />
                {editingRole.is_system && <p className="text-xs text-amber-600 mt-1">System roles cannot be renamed.</p>}
              </FormRow>

              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">Permissions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {PERMISSIONS_LIST.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100">
                      <input
                        type="checkbox"
                        className="accent-rose-600 size-4"
                        {...registerRole(`permissions.${perm.id}`)}
                        disabled={editingRole.is_system && perm.id === 'owner_override'}
                      />
                      <span className="font-semibold text-slate-800">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">Save Role</Button>
                <Button type="button" variant="secondary" onClick={() => setEditingRole(null)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-4 font-bold">Role Name</th>
                    <th className="py-3 px-4 font-bold">Permissions</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roleList.map((role) => {
                    const permCount = Object.values(role.permissions || {}).filter(Boolean).length
                    return (
                      <tr key={role.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {role.name}
                          {role.is_system && <Badge tone="amber" className="ml-2 text-[10px]">SYSTEM</Badge>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {permCount} permissions enabled
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => onEditRole(role)} className="text-indigo-600 font-bold hover:underline mr-3">Edit</button>
                          {!role.is_system && (
                            <button onClick={() => deleteRole(role.id)} className="text-rose-600 font-bold hover:underline">Delete</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-slate-900">Staff Users</h2>
            {!editingUser && (
              <Button onClick={onNewUser} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                + Create Staff
              </Button>
            )}
          </div>

          {editingUser ? (
            <form onSubmit={handleUserSubmit(saveUser)} className="space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Username" required>
                  <Input {...registerUser('username', { required: true })} className="rounded-xl" />
                </FormRow>
                <FormRow label="Password" required={editingUser.id === 'new'}>
                  <Input type="password" {...registerUser('password', { required: editingUser.id === 'new' })} placeholder={editingUser.id !== 'new' ? '(leave blank to keep)' : ''} className="rounded-xl" />
                </FormRow>
                <FormRow label="First Name">
                  <Input {...registerUser('first_name')} className="rounded-xl" />
                </FormRow>
                <FormRow label="Last Name">
                  <Input {...registerUser('last_name')} className="rounded-xl" />
                </FormRow>
                <FormRow label="Phone">
                  <Input {...registerUser('phone')} className="rounded-xl" />
                </FormRow>
                <FormRow label="Assigned Role" required>
                  <select {...registerUser('custom_role', { required: true })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-rose-500 focus:outline-none">
                    <option value="">-- Select Role --</option>
                    {roleList.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </FormRow>
              </div>
              
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input type="checkbox" {...registerUser('is_active')} className="accent-rose-600 size-4" />
                <span className="font-bold text-slate-700">Account Active (can login)</span>
              </label>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">Save Staff</Button>
                <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-4 font-bold">Username</th>
                    <th className="py-3 px-4 font-bold">Name</th>
                    <th className="py-3 px-4 font-bold">Role</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{u.username}</td>
                      <td className="py-3 px-4 text-slate-700">{u.first_name} {u.last_name}</td>
                      <td className="py-3 px-4">
                        <Badge tone="blue">{u.custom_role?.name || u.role_display}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => onEditUser(u)} className="text-indigo-600 font-bold hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
