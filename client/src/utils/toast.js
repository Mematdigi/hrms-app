// src/utils/toast.js
import { toast } from "react-toastify";

const dedupe = (arr) => [...new Set(arr.filter(Boolean).map(s => String(s).trim()))];

const normalize = (err) => {
  if (!err) return ["Something went wrong."];
  if (typeof err === "string") return [err];
  if (err instanceof Error) return [err.message];

  const msgs = [];
  if (typeof err === "object") {
    if (err.msg) msgs.push(err.msg);
    if (err.message) msgs.push(err.message);
    if (typeof err.error === "string") msgs.push(err.error);
    if (Array.isArray(err.errors)) {
      err.errors.forEach(e =>
        msgs.push(typeof e === "string" ? e : e?.message || JSON.stringify(e))
      );
    }
  }
  return msgs.length ? msgs : ["Unexpected error."];
};

export function showError(err, options = {}) {
  dedupe(normalize(err)).forEach((m) =>
    toast.error(m, { autoClose: 4000, ...options })
  );
}

export function showSuccess(msg, options = {}) {
  toast.success(String(msg || "Success"), { autoClose: 3000, ...options });
}
    