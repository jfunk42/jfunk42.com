const visitorVoteLimit = 2;
const visitorVoteStorageKey = "jfunk42-feature-request-visitor-votes";
const featureCatalogUrl = "/new-feature-request/features.json";
const voteTotalsUrl = "/new-feature-request/votes.json";
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

function getFeatureTotals(featureId, serverTotals, state) {
  const serverFeatureTotals = serverTotals[featureId] || {};
  const localFeatureTotals = state.localTotals[featureId] || {};
  const up = Number(serverFeatureTotals.up || 0) + Number(localFeatureTotals.up || 0);
  const down = Number(serverFeatureTotals.down || 0) + Number(localFeatureTotals.down || 0);

  return { up, down, net: up - down };
}

function createVoteButton(direction, feature, state, serverTotals, renderFeatures) {
  const button = document.createElement("button");
  button.className = `vote-button vote-${direction}`;
  button.type = "button";
  button.textContent = direction === "up" ? "Vote up" : "Vote down";
  button.disabled = state.used >= visitorVoteLimit;

  button.addEventListener("click", () => {
    if (state.used >= visitorVoteLimit) {
      setVoteStatus(
        state,
        "Your two visitor votes are used for this week. Join or log in on Patreon for member benefits.",
      );
      renderFeatures();
      return;
    }

    const featureTotals = state.localTotals[feature.id] || { up: 0, down: 0 };
    featureTotals[direction] += 1;
    state.localTotals[feature.id] = featureTotals;
    state.used += 1;
    if (!saveVoteState(state)) {
      featureTotals[direction] -= 1;
      state.used -= 1;
      setVoteStatus(state, "Your vote could not be stored locally, so it was not recorded.");
      return;
    }

    setVoteStatus(state, "Thanks—your visitor vote was recorded.");
    trackVoteEvent("patreon_feature_vote", {
      feature_id: feature.id,
      vote_direction: direction,
      vote_weight: 1,
      voter_access: "visitor",
      membership_tier: "visitor",
    });
    renderFeatures();
  });

  return button;
}

function createTotal(label, value) {
  const total = document.createElement("span");
  const amount = document.createElement("strong");

  amount.textContent = value.toString();
  total.append(amount, ` ${label}`);
  return total;
}

function renderFeatureList(features, serverTotals, state) {
  const featureList = document.querySelector("#feature-list");
  const sortedFeatures = [...features].sort((first, second) => {
    const firstTotals = getFeatureTotals(first.id, serverTotals, state);
    const secondTotals = getFeatureTotals(second.id, serverTotals, state);
    return secondTotals.net - firstTotals.net || first.title.localeCompare(second.title);
  });

  const fragment = document.createDocumentFragment();
  for (const feature of sortedFeatures) {
    const totals = getFeatureTotals(feature.id, serverTotals, state);
    const item = document.createElement("li");
    const article = document.createElement("article");
    const content = document.createElement("div");
    const area = document.createElement("p");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const votePanel = document.createElement("div");
    const voteTotals = document.createElement("div");
    const net = document.createElement("span");
    const actions = document.createElement("div");

    article.className = "feature-card";
    area.className = "feature-area";
    area.textContent = feature.area;
    title.textContent = feature.title;
    description.textContent = feature.description;
    content.append(area, title, description);

    votePanel.className = "vote-panel";
    voteTotals.className = "vote-totals";
    net.className = "net-votes";
    net.textContent = `Net ${totals.net >= 0 ? "+" : ""}${totals.net}`;
    voteTotals.append(createTotal("support", totals.up), createTotal("not now", totals.down), net);

    actions.className = "vote-actions";
    actions.append(
      createVoteButton("up", feature, state, serverTotals, () => {
        renderFeatureList(features, serverTotals, state);
      }),
      createVoteButton("down", feature, state, serverTotals, () => {
        renderFeatureList(features, serverTotals, state);
      }),
    );
    votePanel.append(voteTotals, actions);
    article.append(content, votePanel);
    item.append(article);
    fragment.append(item);
  }

  featureList.replaceChildren(fragment);
}

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load ${url}: ${response.status}`);
  }

  return response.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  const voteState = getVoteState();
  if (!voteState) {
    document.querySelector("#vote-status").textContent = (
      "Voting is unavailable because this browser cannot store your weekly allowance."
    );
    trackVoteEvent("patreon_feature_vote_storage_unavailable", {
      voter_access: "visitor",
    });
    return;
  }

  setVoteStatus(voteState);

  try {
    const [catalog, totals] = await Promise.all([
      loadJson(featureCatalogUrl),
      loadJson(voteTotalsUrl),
    ]);
    const features = Array.isArray(catalog.features) ? catalog.features : [];
    if (!features.length) {
      throw new Error("Feature catalog is empty.");
    }

    renderFeatureList(features, totals.features || {}, voteState);
  } catch {
    document.querySelector("#feature-list").textContent = (
      "Feature requests are temporarily unavailable. Please try again later."
    );
    setVoteStatus(voteState, "Voting is temporarily unavailable.");
    return;
  }

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
}, { once: true });
