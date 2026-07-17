const Notification = require("../models/Notification"); // ✅ Use correct model

const Policy = require("../models/AgentPolicies"); // Ensure correct model is used
// Function to save notification in DB

const dayjs = require("dayjs");
const saveNotification = async (agentId, policyId, message, occasion) => {
  try {
    const newNotification = new Notification({
      agentId,
      policyId,
      message,
      occasion, // <-- save occasion too
    });

    await newNotification.save();
    console.log("✅ Notification saved:", newNotification);
  } catch (error) {
    console.error("❌ Failed to save notification:", error.message);
  }
};

const formatTimeToAmPm = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert to 12-hour format
    return `${hours}:${minutes} ${ampm}`;
};

const updatePolicyStatus = async (policyId, agentId, updates) =>{
 await Policy.findByIdAndUpdate(
  policyId, 
  { 
    agentId: agentId, 
    $set: updates 
  }, 
  { new: true, runValidators: true }
);

}

// jobs/updatePolicyStatuses.js


const runPolicyStatusUpdateJob = async ()=> {
  console.log("🚀 Running daily policy status update job...");

  const policies = await Policy.find({});
  const today = dayjs().startOf("day");
  const cutoff = today.subtract(10, "day");

  for (let p of policies) {
    if (p.status === "paid") continue; // skip paid policies

    const rawEnd = p.endDate || p.policyDetails?.endDate || p.policyDetails?.end_date;
    const endDate = dayjs(rawEnd).startOf("day");
    if (!endDate.isValid()) continue;

    let newStatus = "Due"; // default

    if (endDate.isAfter(today)) {
      const diffDays = endDate.diff(today, "day");
      if (diffDays === 1 || diffDays === 2) {
        newStatus = "Within48h";
      } else {
        newStatus = "Due";
      }
    } else if (endDate.isSame(today) || endDate.isAfter(cutoff)) {
      newStatus = "Overdue";
    } else {
      newStatus = "Expired";
    }
    // Only update if status changed
    if (p.status !== newStatus) {
      const updated = await updatePolicyStatus(p._id, p.agentId, { status: newStatus });
      if (updated) {
        console.log(`✅ Policy ${p._id} updated → ${newStatus}`);
      } else {
        console.warn(`⚠️ Failed to update Policy ${p._id}`);
      }
    }
  }
  console.log("🎯 Policy status update job completed.");
}




module.exports = {saveNotification, formatTimeToAmPm,updatePolicyStatus,runPolicyStatusUpdateJob};
