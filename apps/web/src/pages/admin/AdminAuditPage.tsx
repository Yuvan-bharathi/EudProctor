import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { type AuditLogRow, getPersistedAuditLogs } from "@/lib/mockData";

export function AdminAuditPage() {
  usePageTitle("System Audit Logs · Admin");
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<AuditLogRow[]>(getPersistedAuditLogs);

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getPersistedAuditLogs());
    };
    window.addEventListener("eduproctor_audit_logs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("eduproctor_audit_logs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text">Platform Audit Trail</h2>
          <p className="text-xs text-muted">
            Tamper-evident logs of every proctoring alert, mentor approval, and AI agent execution.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search audit actions, actors, targets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Timestamp (UTC)</TH>
              <TH>Actor</TH>
              <TH>Role</TH>
              <TH>Action</TH>
              <TH>Target</TH>
              <TH>IP Address</TH>
              <TH className="text-right">Status</TH>
            </tr>
          </THead>
          <TBody>
            {filteredLogs.map((log) => (
              <TR key={log.id} className="transition-colors hover:bg-surface-muted/50">
                <TD className="font-mono text-xs text-muted">{log.timestamp}</TD>
                <TD className="text-xs font-semibold text-text">{log.actor}</TD>
                <TD>
                  <span className="rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                    {log.role}
                  </span>
                </TD>
                <TD className="text-xs font-medium text-text">{log.action}</TD>
                <TD className="text-xs text-muted font-mono">{log.target}</TD>
                <TD className="text-xs text-muted font-mono">{log.ip}</TD>
                <TD className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.status === "Success"
                        ? "bg-success-50 text-success-700"
                        : "bg-warning-50 text-warning-800"
                    }`}
                  >
                    {log.status}
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
