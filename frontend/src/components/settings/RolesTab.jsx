import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { roles, users } from '@/services/auth'
import { errorMessage } from '@/services/api'
import { PERMISSION_MODULES, ROLE_PRESETS } from '@/utils/roles'
import Button from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { Badge, EmptyState, PageLoader, Toggle } from '@/components/ui/Misc'

const ROLE_TONE_MAP = {
  owner: 'red',
  manager: 'purple',
  cashier: 'green',
  waiter: 'amber',
  chef: 'blue',
  kitchen: 'blue',
}

function getRoleTone(roleName) {
  const lower = (roleName || '').toLowerCase()
  for (const [key, tone] of Object.entries(ROLE_TONE_MAP)) {
    if (lower.includes(key)) return tone
  }
  return 'slate'
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  let pass = ''
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

export default function RolesTab() {
  const toast = useToast()
  const { user: currentUser } = useAuth()

  const [roleList, setRoleList] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)

  // Sub-tabs: 'users' | 'roles'
  const [activeSubTab, setActiveSubTab] = useState('users')

  // Search & Filter state for staff list
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modals & Forms
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showUserPassword, setShowUserPassword] = useState(false)

  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetTargetUser, setResetTargetUser] = useState(null)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  // Role editing
  const [editingRole, setEditingRole] = useState(null)
  const [rolePermissions, setRolePermissions] = useState({})
  const [roleSaving, setRoleSaving] = useState(false)

  const {
    register: registerUser,
    handleSubmit: handleUserSubmit,
    reset: resetUserForm,
    setValue: setUserValue,
    formState: { errors: userErrors, isSubmitting: isSubmittingUser },
  } = useForm()

  const {
    register: registerRole,
    handleSubmit: handleRoleSubmit,
    reset: resetRoleForm,
    setValue: setRoleValue,
    formState: { errors: roleErrors },
  } = useForm()

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
      toast.error(errorMessage(err, 'Failed to load staff & roles data.'))
    } finally {
      setLoading(false)
    }
  }

  // --- Filtered Users ---
  const filteredUsers = useMemo(() => {
    return userList.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole =
        roleFilter === 'ALL' ||
        String(u.custom_role?.id) === String(roleFilter) ||
        u.role === roleFilter

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.is_active) ||
        (statusFilter === 'INACTIVE' && !u.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [userList, searchQuery, roleFilter, statusFilter])

  // --- Stats ---
  const stats = useMemo(() => {
    const totalStaff = userList.length
    const activeStaff = userList.filter((u) => u.is_active).length
    const totalRoles = roleList.length
    const adminCount = userList.filter((u) => u.is_owner || u.role === 'OWNER').length
    return { totalStaff, activeStaff, totalRoles, adminCount }
  }, [userList, roleList])

  // --- User Actions ---
  const openCreateUserModal = () => {
    setEditingUser(null)
    setShowUserPassword(false)
    resetUserForm({
      username: '',
      password: generateRandomPassword(),
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      custom_role: roleList[0]?.id || '',
      is_active: true,
    })
    setUserModalOpen(true)
  }

  const openEditUserModal = (u) => {
    setEditingUser(u)
    setShowUserPassword(false)
    resetUserForm({
      username: u.username,
      password: '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      email: u.email || '',
      custom_role: u.custom_role?.id || '',
      is_active: u.is_active,
    })
    setUserModalOpen(true)
  }

  const handleSaveUser = async (data) => {
    try {
      const payload = { ...data }
      if (!payload.password) delete payload.password
      if (payload.custom_role === '') payload.custom_role = null
      if (payload.email) payload.email = payload.email.trim()

      if (editingUser) {
        await users.update(editingUser.id, payload)
        toast.success(`Staff account "${payload.username}" updated successfully!`)
      } else {
        await users.create(payload)
        toast.success(`Staff member "${payload.username}" created successfully!`)
      }
      setUserModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save staff user.'))
    }
  }

  const handleToggleActive = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('Aap apna account deactivate nahi kar sakte.')
      return
    }
    const newStatus = !targetUser.is_active
    try {
      await users.update(targetUser.id, { is_active: newStatus })
      setUserList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u)),
      )
      toast.success(
        `Staff "${targetUser.username}" ${newStatus ? 'activated' : 'deactivated'}.`,
      )
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update user status.'))
    }
  }

  const openResetPasswordModal = (u) => {
    setResetTargetUser(u)
    setNewPasswordValue(generateRandomPassword())
    setShowResetPassword(false)
    setResetModalOpen(true)
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    if (!newPasswordValue || newPasswordValue.length < 4) {
      toast.error('Password must be at least 4 characters long.')
      return
    }
    setIsResetting(true)
    try {
      await users.resetPassword(resetTargetUser.id, newPasswordValue)
      toast.success(`Password for "${resetTargetUser.username}" has been reset!`)
      setResetModalOpen(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reset password.'))
    } finally {
      setIsResetting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return
    setIsDeletingUser(true)
    try {
      await users.remove(deleteConfirmUser.id)
      toast.success(`User "${deleteConfirmUser.username}" deleted.`)
      setDeleteConfirmUser(null)
      fetchData()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete user.'))
    } finally {
      setIsDeletingUser(false)
    }
  }

  // --- Role Actions ---
  const openCreateRole = () => {
    setEditingRole({ id: 'new', is_system: false })
    resetRoleForm({ name: '', description: '' })
    setRolePermissions({})
  }

  const openEditRole = (role) => {
    setEditingRole(role)
    resetRoleForm({
      name: role.name,
      description: role.description || '',
    })
    setRolePermissions(role.permissions || {})
  }

  const handlePermissionToggle = (permId) => {
    setRolePermissions((prev) => ({
      ...prev,
      [permId]: !prev[permId],
    }))
  }

  const handleCategoryToggleAll = (module, selectAll) => {
    setRolePermissions((prev) => {
      const next = { ...prev }
      module.permissions.forEach((p) => {
        next[p.id] = selectAll
      })
      return next
    })
  }

  const applyPreset = (preset) => {
    resetRoleForm({
      name: editingRole?.is_system ? editingRole.name : preset.name,
      description: preset.description,
    })
    setRolePermissions(preset.permissions)
    toast.success(`Loaded "${preset.name}" permissions preset!`)
  }

  const handleSelectAllPermissions = (all) => {
    const next = {}
    PERMISSION_MODULES.forEach((mod) => {
      mod.permissions.forEach((p) => {
        next[p.id] = all
      })
    })
    setRolePermissions(next)
  }

  const handleSaveRole = async (data) => {
    setRoleSaving(true)
    try {
      const payload = {
        name: data.name.trim(),
        description: data.description ? data.description.trim() : '',
        permissions: rolePermissions,
      }
      if (editingRole.id === 'new') {
        await roles.create(payload)
        toast.success(`Role "${payload.name}" created successfully!`)
      } else {
        await roles.update(editingRole.id, payload)
        toast.success(`Role "${payload.name}" updated successfully!`)
      }
      setEditingRole(null)
      fetchData()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save role.'))
    } finally {
      setRoleSaving(false)
    }
  }

  const handleDeleteRole = async (role) => {
    if (role.is_system) {
      toast.error('System roles cannot be deleted.')
      return
    }
    if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return
    try {
      await roles.remove(role.id)
      toast.success(`Role "${role.name}" deleted.`)
      fetchData()
    } catch (err) {
      toast.error(errorMessage(err, 'Cannot delete role.'))
    }
  }

  if (loading) return <PageLoader label="Loading staff and role configurations…" />

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 font-black text-xl">
            👥
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Staff</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalStaff}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 font-black text-xl">
            🟢
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Users</p>
            <p className="text-2xl font-black text-slate-900">{stats.activeStaff}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xl">
            🛡️
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Roles Configured</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalRoles}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 font-black text-xl">
            👑
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Admins / Owners</p>
            <p className="text-2xl font-black text-slate-900">{stats.adminCount}</p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Sub-Tabs Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveSubTab('users')
                setEditingRole(null)
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
                activeSubTab === 'users'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>👥 Staff Users</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {stats.totalStaff}
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('roles')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
                activeSubTab === 'roles'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🛡️ Roles &amp; Permissions</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {stats.totalRoles}
              </span>
            </button>
          </div>

          {activeSubTab === 'users' && (
            <Button
              onClick={openCreateUserModal}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20 text-xs py-2 px-4"
            >
              + Add New Staff
            </Button>
          )}

          {activeSubTab === 'roles' && !editingRole && (
            <Button
              onClick={openCreateRole}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20 text-xs py-2 px-4"
            >
              + Create Custom Role
            </Button>
          )}
        </div>

        {/* SUB-TAB 1: STAFF USERS */}
        {activeSubTab === 'users' && (
          <div className="p-6 space-y-6">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff by name, username, phone…"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100 transition"
                />
                <span className="absolute left-3.5 top-2.5 text-slate-400">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-rose-500"
                >
                  <option value="ALL">All Roles</option>
                  {roleList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-rose-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            {filteredUsers.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No staff members found"
                hint={
                  searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'Try clearing your search query or filters.'
                    : 'Create your first staff user to assign counter and kitchen roles.'
                }
                action={
                  searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery('')
                        setRoleFilter('ALL')
                        setStatusFilter('ALL')
                      }}
                      className="text-xs"
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={openCreateUserModal} className="bg-rose-600 text-white text-xs">
                      + Add Staff Member
                    </Button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const roleName = u.custom_role?.name || u.role_display || u.role
                      const tone = getRoleTone(roleName)
                      const isSelf = u.id === currentUser?.id

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex size-10 shrink-0 items-center justify-center rounded-2xl font-black text-sm uppercase ${
                                  tone === 'red'
                                    ? 'bg-rose-100 text-rose-700'
                                    : tone === 'purple'
                                    ? 'bg-purple-100 text-purple-700'
                                    : tone === 'green'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : tone === 'amber'
                                    ? 'bg-amber-100 text-amber-700'
                                    : tone === 'blue'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {(u.first_name || u.username || '?').charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-extrabold text-slate-900">
                                    {u.full_name || u.username}
                                  </p>
                                  {isSelf && (
                                    <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[9px] font-black text-rose-600 border border-rose-200">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-slate-400">@{u.username}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge tone={tone}>{roleName}</Badge>
                          </td>

                          <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                            {u.phone ? <p>📞 {u.phone}</p> : null}
                            {u.email ? <p className="text-slate-400">✉️ {u.email}</p> : null}
                            {!u.phone && !u.email && <span className="text-slate-300">—</span>}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Toggle
                                checked={u.is_active}
                                onChange={() => handleToggleActive(u)}
                                disabled={isSelf}
                                label="Toggle active status"
                              />
                              <span
                                className={`text-[11px] font-bold ${
                                  u.is_active ? 'text-emerald-600' : 'text-slate-400'
                                }`}
                              >
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditUserModal(u)}
                                title="Edit Staff Details"
                                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => openResetPasswordModal(u)}
                                title="Reset Staff Password"
                                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition active:scale-95"
                              >
                                🔑
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => setDeleteConfirmUser(u)}
                                  title="Delete Staff Account"
                                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition active:scale-95"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
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

        {/* SUB-TAB 2: ROLES & PERMISSIONS */}
        {activeSubTab === 'roles' && (
          <div className="p-6">
            {!editingRole ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Custom Roles &amp; Matrix</h3>
                    <p className="text-xs font-semibold text-slate-400">
                      Configure granular access levels for different staff responsibilities.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roleList.map((role) => {
                    const tone = getRoleTone(role.name)
                    const permCount = Object.values(role.permissions || {}).filter(Boolean).length
                    const totalPerms = PERMISSION_MODULES.reduce(
                      (acc, m) => acc + m.permissions.length,
                      0,
                    )

                    return (
                      <div
                        key={role.id}
                        className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                              {role.name}
                            </h4>
                            {role.is_system ? (
                              <Badge tone="amber" className="text-[10px]">
                                SYSTEM
                              </Badge>
                            ) : (
                              <Badge tone="slate" className="text-[10px]">
                                CUSTOM
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs font-medium text-slate-500 line-clamp-2 min-h-[32px]">
                            {role.description || 'Custom restaurant role.'}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2 items-center">
                            <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                              👥 {role.user_count ?? 0} Staff
                            </span>
                            <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                              ⚡ {permCount} / {totalPerms} Perms
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <button
                            onClick={() => openEditRole(role)}
                            className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                          >
                            ✏️ Edit Permissions
                          </button>

                          {!role.is_system && (
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="text-xs font-extrabold text-rose-600 hover:text-rose-800 hover:underline"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ROLE EDIT / CREATE FORM */
              <form onSubmit={handleRoleSubmit(handleSaveRole)} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {editingRole.id === 'new'
                        ? 'Create Custom Role'
                        : `Edit Role: ${editingRole.name}`}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400">
                      Customize role details and grant module permissions.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingRole(null)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      loading={roleSaving}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-rose-600/20"
                    >
                      Save Role &amp; Permissions
                    </Button>
                  </div>
                </div>

                {/* Role Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <FormRow
                    label="Role Name"
                    required
                    error={roleErrors.name?.message}
                    htmlFor="role_name"
                  >
                    <Input
                      id="role_name"
                      disabled={editingRole.is_system}
                      className="rounded-xl font-bold"
                      {...registerRole('name', { required: 'Role name is required' })}
                    />
                    {editingRole.is_system && (
                      <p className="text-[11px] font-bold text-amber-600 mt-1">
                        System role names cannot be changed.
                      </p>
                    )}
                  </FormRow>

                  <FormRow label="Description / Responsibility" htmlFor="role_desc">
                    <Input
                      id="role_desc"
                      placeholder="e.g. Counter cashier handling takeaway and payments"
                      className="rounded-xl"
                      {...registerRole('description')}
                    />
                  </FormRow>
                </div>

                {/* Quick Presets Bar */}
                <div className="flex flex-wrap items-center gap-2 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                  <span className="text-xs font-black text-rose-800 uppercase tracking-wider mr-2">
                    ⚡ Quick Presets:
                  </span>
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-xl bg-white border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:text-rose-900 active:scale-95 transition"
                    >
                      {preset.name}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllPermissions(true)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllPermissions(false)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Permissions Categorized Matrix */}
                <div className="space-y-6">
                  {PERMISSION_MODULES.map((module) => {
                    const modulePerms = module.permissions
                    const grantedCount = modulePerms.filter((p) => rolePermissions[p.id]).length
                    const allGranted = grantedCount === modulePerms.length

                    return (
                      <div
                        key={module.id}
                        className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl" aria-hidden>
                              {module.icon}
                            </span>
                            <div>
                              <h4 className="text-sm font-black text-slate-900">{module.name}</h4>
                              <p className="text-[11px] font-medium text-slate-400">
                                {module.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-500 bg-slate-100 rounded-lg px-2 py-1">
                              {grantedCount} / {modulePerms.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCategoryToggleAll(module, !allGranted)}
                              className="text-xs font-bold text-rose-600 hover:underline"
                            >
                              {allGranted ? 'Deselect Module' : 'Select Module'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {modulePerms.map((perm) => {
                            const isChecked = Boolean(rolePermissions[perm.id])

                            return (
                              <label
                                key={perm.id}
                                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-rose-50/60 border-rose-200 ring-1 ring-rose-200'
                                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handlePermissionToggle(perm.id)}
                                  className="accent-rose-600 size-4 mt-0.5 rounded cursor-pointer shrink-0"
                                />
                                <div className="space-y-0.5">
                                  <p className="text-xs font-black text-slate-900">{perm.label}</p>
                                  <p className="text-[10px] font-medium text-slate-500 leading-tight">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingRole(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={roleSaving}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20"
                  >
                    Save Role &amp; Permissions
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT STAFF USER MODAL */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? `Edit Staff: ${editingUser.username}` : 'Add New Staff Member'}
        subtitle={
          editingUser
            ? 'Update profile details, contact info or assign a new role.'
            : 'Create credentials and assign responsibilities for your staff.'
        }
        size="md"
      >
        <form onSubmit={handleUserSubmit(handleSaveUser)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormRow label="Username (Login ID)" required error={userErrors.username?.message}>
              <Input
                placeholder="e.g. cashier1"
                className="rounded-xl font-bold"
                {...registerUser('username', {
                  required: 'Username is required',
                  minLength: { value: 3, message: 'Minimum 3 characters' },
                })}
              />
            </FormRow>

            <FormRow
              label={editingUser ? 'Password (Leave blank to keep)' : 'Login Password'}
              required={!editingUser}
              error={userErrors.password?.message}
            >
              <div className="relative">
                <Input
                  type={showUserPassword ? 'text' : 'password'}
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                  className="rounded-xl pr-20"
                  {...registerUser('password', {
                    required: !editingUser ? 'Password is required' : false,
                    minLength: { value: 4, message: 'Minimum 4 characters' },
                  })}
                />
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="text-xs p-1 text-slate-400 hover:text-slate-600"
                    title={showUserPassword ? 'Hide password' : 'Show password'}
                  >
                    {showUserPassword ? '👁️' : '🙈'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserValue('password', generateRandomPassword())}
                    className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                    title="Generate random password"
                  >
                    🎲
                  </button>
                </div>
              </div>
            </FormRow>

            <FormRow label="First Name">
              <Input
                placeholder="e.g. Ramesh"
                className="rounded-xl"
                {...registerUser('first_name')}
              />
            </FormRow>

            <FormRow label="Last Name">
              <Input
                placeholder="e.g. Kumar"
                className="rounded-xl"
                {...registerUser('last_name')}
              />
            </FormRow>

            <FormRow label="Phone Number">
              <Input
                placeholder="e.g. 9876543210"
                className="rounded-xl"
                {...registerUser('phone')}
              />
            </FormRow>

            <FormRow label="Email Address">
              <Input
                type="email"
                placeholder="staff@restaurant.com"
                className="rounded-xl"
                {...registerUser('email')}
              />
            </FormRow>
          </div>

          <FormRow label="Assigned Role &amp; Permissions" required>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
              {...registerUser('custom_role', { required: 'Please select a role' })}
            >
              <option value="">-- Select Role --</option>
              {roleList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.is_system ? '(System)' : ''}
                </option>
              ))}
            </select>
          </FormRow>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                className="accent-rose-600 size-4 rounded"
                {...registerUser('is_active')}
              />
              <div>
                <p className="text-xs font-black text-slate-900">Active Account (Can Login)</p>
                <p className="text-[10px] font-medium text-slate-500">
                  Uncheck to temporarily suspend access without deleting their history.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUserModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmittingUser}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20"
            >
              {editingUser ? 'Save Changes' : 'Create Staff Member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Staff Password"
        subtitle={`Set a new login password for user @${resetTargetUser?.username}.`}
        size="sm"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <p className="text-xs font-black text-amber-900">
                {resetTargetUser?.full_name || resetTargetUser?.username}
              </p>
              <p className="text-[11px] font-semibold text-amber-700">
                Role: {resetTargetUser?.custom_role?.name || resetTargetUser?.role_display}
              </p>
            </div>
          </div>

          <FormRow label="New Password" required>
            <div className="relative">
              <Input
                type={showResetPassword ? 'text' : 'password'}
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="Enter new password"
                className="rounded-xl pr-20 font-bold"
                required
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="text-xs p-1 text-slate-400 hover:text-slate-600"
                  title={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? '👁️' : '🙈'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewPasswordValue(generateRandomPassword())}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                  title="Generate random password"
                >
                  🎲
                </button>
              </div>
            </div>
          </FormRow>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newPasswordValue)
                toast.success('Password copied to clipboard!')
              }}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              📋 Copy Password
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isResetting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-md shadow-amber-600/20"
            >
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal
        open={Boolean(deleteConfirmUser)}
        onClose={() => setDeleteConfirmUser(null)}
        title="Delete Staff Member?"
        subtitle="This action will remove their login access."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-600">
            Are you sure you want to permanently delete account for{' '}
            <strong className="text-slate-900">@{deleteConfirmUser?.username}</strong>?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-800">
            💡 Past orders, receipts, and KOT records created by this user will remain safe in
            history. Alternatively, you can deactivate their account instead of deleting.
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteConfirmUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteUser}
              loading={isDeletingUser}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl"
            >
              Yes, Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
