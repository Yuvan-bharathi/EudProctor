import {
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { type AdminUserRow, mockAdminUsers } from "@/lib/mockData";

type RoleFilter = "all" | "mentors" | "candidates" | "admins";

export function AdminUsersPage() {
  usePageTitle("User Management · Admin");

  const [activeTab, setActiveTab] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [addUserModal, setAddUserModal] = useState(false);

  // New user form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Mentor" | "Candidate" | "Admin">("Candidate");
  const [usersList, setUsersList] = useState<AdminUserRow[]>(mockAdminUsers);

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      activeTab === "all"
        ? true
        : activeTab === "mentors"
          ? u.role === "Mentor"
          : activeTab === "candidates"
            ? u.role === "Candidate"
            : u.role === "Admin";
    return matchesSearch && matchesRole;
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const newUser: AdminUserRow = {
      id: `u-${Date.now()}`,
      name,
      email,
      role,
      status: "Active",
    };
    setUsersList([newUser, ...usersList]);
    setAddUserModal(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header matching Screen 10 */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text">User Management</h2>
          <p className="text-xs text-muted">Manage mentors, candidates and admins.</p>
        </div>

        <Button
          onClick={() => setAddUserModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 shadow-xs"
        >
          <Plus className="size-4" />
          <span>Add user</span>
        </Button>
      </div>

      {/* Filter Tabs matching Screen 10:
          All (1,288), Mentors (48), Candidates (1,240), Admins (3) */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { key: "all", label: "All", count: "1,288" },
          { key: "mentors", label: "Mentors", count: "48" },
          { key: "candidates", label: "Candidates", count: "1,240" },
          { key: "admins", label: "Admins", count: "3" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as RoleFilter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary-50 text-primary-700 shadow-2xs"
                : "text-muted hover:bg-surface-muted hover:text-text"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search & Actions Bar matching Screen 10 */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs text-muted hover:text-text">
            <Filter className="size-3.5" />
            <span>Filters</span>
          </Button>
        </div>
      </div>

      {/* Users Table matching Screen 10 */}
      <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <TBody>
            {filteredUsers.map((u) => (
              <TR key={u.id} className="transition-colors hover:bg-surface-muted/50">
                <TD>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-xs text-text">{u.name}</span>
                  </div>
                </TD>

                <TD className="font-mono text-xs text-muted">{u.email}</TD>

                <TD>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.role === "Mentor"
                        ? "bg-ai-50 text-ai-700"
                        : u.role === "Admin"
                          ? "bg-primary-50 text-primary-700"
                          : "bg-surface-muted text-text"
                    }`}
                  >
                    {u.role}
                  </span>
                </TD>

                <TD>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === "Active"
                        ? "bg-success-50 text-success-700"
                        : "bg-surface-muted text-muted"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        u.status === "Active" ? "bg-success-500" : "bg-border-strong"
                      }`}
                    />
                    {u.status}
                  </span>
                </TD>

                <TD className="text-right">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-700 hover:underline"
                    onClick={() => {}}
                  >
                    Edit
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* "+ Add User" Modal Dialog */}
      {addUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-text">Add New User</h3>
              <button
                type="button"
                onClick={() => setAddUserModal(false)}
                className="rounded p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <Label htmlFor="usr-name">Full Name</Label>
                <Input
                  id="usr-name"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="usr-email">Email Address</Label>
                <Input
                  id="usr-email"
                  type="email"
                  placeholder="e.g. priya@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="usr-role">Role</Label>
                <select
                  id="usr-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
                >
                  <option value="Mentor">Mentor (Instructor / Course Creator)</option>
                  <option value="Candidate">Candidate (Student / Learner)</option>
                  <option value="Admin">Admin (System Administrator)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="secondary" onClick={() => setAddUserModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary-600 text-white hover:bg-primary-700">
                  Save user
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

