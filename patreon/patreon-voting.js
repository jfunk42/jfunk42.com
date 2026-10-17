const visitorVoteLimit = 2;
const visitorVoteStorageKey = "jfunk42-patreon-visitor-votes";
const voteTotalsUrl = "/patreon/votes.json";
let recoveredInvalidVoteState = false;

function getWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  const dayOffset = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - dayOffset);
  return utcDate.toISOString().slice(0, 10);
}

function getVoteState() {
  const currentWeek = getWeekKey();
  let serializedState;

  try {
    serializedState = localStorage.getItem(visitorVoteStorageKey);
  } catch {
    return null;
  }

  if (!serializedState) {
    return { week: currentWeek, used: 0, localTotals: {} };
  }

  try {
    const savedState = JSON.parse(serializedState);
    if (savedState && savedState.week === currentWeek) {
      return {
        week: currentWeek,
        used: Number.isInteger(savedState.used) ? savedState.used : 0,
        localTotals: typeof savedState.localTotals === "object" && savedState.localTotals
          ? savedState.localTotals
          : {},
      };
    }
  } catch {
    recoveredInvalidVoteState = true;
  }

  return { week: currentWeek, used: 0, localTotals: {} };
}

function saveVoteState(state) {
  try {
    localStorage.setItem(visitorVoteStorageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function trackVoteEvent(eventName, parameters) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, parameters);
  }
}

function setVoteStatus(state, message) {
  const status = document.querySelector("#vote-status");
  const remaining = Math.max(visitorVoteLimit - state.used, 0);

  status.textContent = message || (
    remaining === 1
      ? "You have 1 visitor vote remaining this week."
      : `You have ${remaining} visitor votes remaining this week.`
  );
}

function updateVoteButtons(state) {
  const isExhausted = state.used >= visitorVoteLimit;

  document.querySelectorAll(".vote-button").forEach((button) => {
    button.disabled = isExhausted;
  });
}

function updateDisplayedTotals(serverTotals, state) {
  document.querySelectorAll("[data-feature-id]").forEach((card) => {
    const featureId = card.dataset.featureId;
    const serverFeatureTotals = serverTotals[featureId] || {};
    const localFeatureTotals = state.localTotals[featureId] || {};

    card.querySelector("[data-up-total]").textContent = (
      Number(serverFeatureTotals.up || 0) + Number(localFeatureTotals.up || 0)
    ).toString();
    card.querySelector("[data-down-total]").textContent = (
      Number(serverFeatureTotals.down || 0) + Number(localFeatureTotals.down || 0)
    ).toString();
  });
}

async function loadVoteTotals() {
  const response = await fetch(voteTotalsUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load vote totals: ${response.status}`);
  }

  const data = await response.json();
  return data.features || {};
}

document.addEventListener("DOMContentLoaded", async () => {
  const voteState = getVoteState();
  let serverTotals = {};

  if (!voteState) {
    const status = document.querySelector("#vote-status");
    status.textContent = "Voting is unavailable because this browser cannot store your weekly allowance.";
    document.querySelectorAll(".vote-button").forEach((button) => {
      button.disabled = true;
    });
    trackVoteEvent("patreon_feature_vote_storage_unavailable", {
      voter_access: "visitor",
    });
    return;
  }

  setVoteStatus(voteState);
  updateVoteButtons(voteState);

  try {
    serverTotals = await loadVoteTotals();
  } catch {
    setVoteStatus(voteState, "Vote totals are temporarily unavailable. You can still cast visitor votes.");
  }

  updateDisplayedTotals(serverTotals, voteState);
  if (recoveredInvalidVoteState) {
    setVoteStatus(
      voteState,
      "Your saved visitor allowance could not be read, so it has been reset for this week.",
    );
  }
  trackVoteEvent("patreon_feature_board_viewed", {
    voter_access: "visitor",
    membership_tier: "visitor",
  });

  document.querySelectorAll(".vote-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (voteState.used >= visitorVoteLimit) {
        setVoteStatus(
          voteState,
          "Your two visitor votes are used for this week. Join or log in on Patreon for member benefits.",
        );
        updateVoteButtons(voteState);
        return;
      }

      const card = button.closest("[data-feature-id]");
      const featureId = card.dataset.featureId;
      const direction = button.dataset.direction;
      const featureTotals = voteState.localTotals[featureId] || { up: 0, down: 0 };

      featureTotals[direction] += 1;
      voteState.localTotals[featureId] = featureTotals;
      voteState.used += 1;
      if (!saveVoteState(voteState)) {
        featureTotals[direction] -= 1;
        voteState.used -= 1;
        setVoteStatus(
          voteState,
          "Your vote could not be stored locally, so it was not recorded.",
        );
        return;
      }

      updateDisplayedTotals(serverTotals, voteState);
      setVoteStatus(voteState, "Thanks—your visitor vote was recorded.");
      updateVoteButtons(voteState);
      trackVoteEvent("patreon_feature_vote", {
        feature_id: featureId,
        vote_direction: direction,
        vote_weight: 1,
        voter_access: "visitor",
        membership_tier: "visitor",
      });
    });
  });
}, { once: true });
