import { getUsers } from "../actions/users";
import { getServerAuthSession } from "../../lib/auth";
import { redirect } from "next/navigation";
import UserList from "../../components/UserList";
import { ShieldAlert } from "lucide-react";

export default async function UsersPage() {
  const session = await getServerAuthSession();
  
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const users = await getUsers();

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create and manage accounts for InventoryPro.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium border border-primary/20">
            <ShieldAlert size={16} />
            Admin Access Only
        </div>
      </div>
      
      <UserList initialUsers={users} currentUserId={session.user.id} />
    </div>
  );
}
