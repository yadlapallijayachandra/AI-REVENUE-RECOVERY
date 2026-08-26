import { localClient } from "@/api/localDataClient";

export async function logAudit(action, entity, details, entityId = "", prev = "", next = "") {
  try {
    let user = "system";
    try { const me = await localClient.auth.me(); if (me) user = me.email || me.full_name || "user"; } catch {}
    await localClient.entities.AuditLog.create({
      action, entity, entity_id: entityId, user,
      previous_value: prev, new_value: next, details,
    });
  } catch {}
}