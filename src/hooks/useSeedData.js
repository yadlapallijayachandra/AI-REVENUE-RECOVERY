import { useEffect, useState, useCallback } from "react";
import { localClient } from "@/api/localDataClient";
import { generateDemoData } from "@/lib/seeData";

// Ensures demo data exists. Seeds in batches if the Transaction entity is empty.
export function useSeedData() {
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [status, setStatus] = useState("idle");

  const checkAndSeed = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await localClient.entities.Transaction.list("-created_date", 1);
      if (!existing || existing.length === 0) {
        setStatus("needs-seed");
      } else {
        setStatus("ready");
      }
    } catch (e) {
      setStatus("error");
    }
    setLoading(false);
  }, []);

  const seed = useCallback(async () => {
    setSeeding(true);
    try {
      const data = generateDemoData({ customerCount: 250, txCount: 1000 });
      // Customers
      for (let i = 0; i < data.customers.length; i += 200) {
        await localClient.entities.Customer.bulkCreate(data.customers.slice(i, i + 200));
      }
      // Transactions in batches of 200
      for (let i = 0; i < data.transactions.length; i += 200) {
        await localClient.entities.Transaction.bulkCreate(data.transactions.slice(i, i + 200));
      }
      // Recovery cases
      for (let i = 0; i < data.recoveryCases.length; i += 200) {
        await localClient.entities.RecoveryCase.bulkCreate(data.recoveryCases.slice(i, i + 200));
      }
      // Notifications
      await localClient.entities.Notification.bulkCreate(data.notifications);
      // Audit logs
      await localClient.entities.AuditLog.bulkCreate(data.auditLogs);
      // Rules
      await localClient.entities.RecoveryRule.bulkCreate(data.rules);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
    setSeeding(false);
  }, []);

  useEffect(() => { checkAndSeed(); }, [checkAndSeed]);

  return { loading, seeding, status, seed, recheck: checkAndSeed };
}