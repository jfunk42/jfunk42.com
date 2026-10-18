const visitorVoteLimit = 2;
const visitorVoteStorageKey = "jfunk42-feature-request-visitor-votes";
const featureCatalogUrl = "/new-feature-request/features.json";
const voteTotalsUrl = "/new-feature-request/votes.json";
const patreonLoginUrl = "https://api.jfunk42.com/auth/patreon";
const patreonLogoutUrl = "https://api.jfunk42.com/api/logout";
const patreonSessionUrl = "https://api.jfunk42.com/api/session";
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

function getAccessParameters(access) {
  if (!access.authenticated) {
    return {
      membership_tier: "visitor",
      voter_access: "visitor",
    };
  }

  return {
    membership_tier: access.membershipTier || "unmapped",
    voter_access: "member",
  };
}

function setVoteStatus(state, access, message) {
  const status = document.querySelector("#vote-status");
  const remaining = Math.max(visitorVoteLimit - state.used, 0);

  if (message) {
    status.textContent = message;
    return;
  }

  const localAllowance = remaining === 1
    ? "1 local visitor vote remaining this week."
    : `${remaining} local visitor votes remaining this week.`;
  status.textContent = access.authenticated
    ? `Your Patreon login is verified${access.membershipTier ? ` for the ${access.membershipTier} tier` : ""}. ${localAllowance}`
    : `You have ${remaining === 1 ? "1 visitor vote" : `${remaining} visitor votes`} remaining this week.`;
}

function updateAccessUi(access) {
  const title = document.querySelector("#voting-status-title");
  const authLink = document.querySelector("#patreon-auth-link");

  if (!access.authenticated) {
    title.textContent = "Visitor access";
    authLink.textContent = "Log in with Patreon";
    authLink.href = patreonLoginUrl;
    authLink.onclick = null;
    return;
  }

  title.textContent = access.membershipTier
    ? `Patreon access: ${access.membershipTier}`
    : "Patreon member access";
  authLink.textContent = "Log out of Patreon";
  authLink.href = patreonLogoutUrl;
  authLink.onclick = async (event) => {
    event.preventDefault();
    authLink.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(patreonLogoutUrl, {
        credentials: "include",
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Unable to log out: ${response.status}`);
      }
      window.location.reload();
    } catch {
      authLink.removeAttribute("aria-busy");
      authLink.textContent = "Log out failed; try again";
    }
  };
}

function canSuggestFeatures(access) {
  if (!access.authenticated || !access.membershipTier) {
    return false;
  }

  return !/^euler(?:\s+tier)?$/i.test(access.membershipTier.trim());
}

function updateSuggestionUi(access) {
  const request = document.querySelector("#suggestion-request");
  const textarea = document.querySelector("#feature-suggestion");
  const submit = document.querySelector("#feature-suggestion-submit");
  const status = document.querySelector("#feature-suggestion-status");
  const upgradeLink = document.querySelector("#feature-suggestion-upgrade-link");
  const isEuler = access.authenticated
    && /^euler(?:\s+tier)?$/i.test((access.membershipTier || "").trim());

  request.classList.toggle("suggestion-request-locked", !canSuggestFeatures(access));
  upgradeLink.hidden = false;
  textarea.disabled = true;
  submit.disabled = true;

  if (!access.authenticated) {
    status.textContent = "Visitors cannot submit feature requests. Join Patreon at the Pi tier or above to unlock requests.";
    upgradeLink.textContent = "Join Patreon to unlock requests";
    return;
  }

  if (isEuler) {
    status.textContent = "Euler-tier members cannot submit feature requests. Upgrade to the Pi tier or above to unlock requests.";
    upgradeLink.textContent = "Upgrade to the Pi tier";
    return;
  }

  status.textContent = "Your membership allows feature requests. Secure request submission will be enabled when authenticated request storage is available.";
  upgradeLink.hidden = true;
}

async function loadPatreonSession() {
  const response = await fetch(patreonSessionUrl, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Unable to load Patreon session: ${response.status}`);
  }

  const session = await response.json();
  return {
    authenticated: session.authenticated === true,
    membershipTier: typeof session.membershipTier === "string" ? session.membershipTier : null,
  };
}

function getFeatureTotals(featureId, serverTotals, state) {
  const serverFeatureTotals = serverTotals[featureId] || {};
  const localFeatureTotals = state.localTotals[featureId] || {};
  const up = Number(serverFeatureTotals.up || 0) + Number(localFeatureTotals.up || 0);
  const down = Number(serverFeatureTotals.down || 0) + Number(localFeatureTotals.down || 0);

  return { up, down, net: up - down };
}

function animateFeatureReorder(featureList, previousPositions) {
  if (!previousPositions.size || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const movedItems = [];
  for (const item of featureList.children) {
    const previousPosition = previousPositions.get(item.dataset.featureId);
    if (!previousPosition) {
      continue;
    }

    const offset = previousPosition.top - item.getBoundingClientRect().top;
    if (!offset) {
      continue;
    }

    item.classList.add("feature-reordering");
    item.style.transition = "none";
    item.style.transform = `translateY(${offset}px)`;
    movedItems.push(item);
  }

  if (!movedItems.length) {
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const item of movedItems) {
        item.style.transition = "";
        item.style.transform = "";
      }
      window.setTimeout(() => {
        for (const item of movedItems) {
          item.classList.remove("feature-reordering");
        }
      }, 1200);
    });
  });
}

function createVoteButton(direction, feature, state, serverTotals, access, renderFeatures) {
  const button = document.createElement("button");
  button.className = `vote-button vote-${direction}`;
  button.type = "button";
  button.textContent = direction === "up" ? "Vote up" : "Vote down";
  button.disabled = state.used >= visitorVoteLimit;

  button.addEventListener("click", () => {
    if (state.used >= visitorVoteLimit) {
      setVoteStatus(
        state,
        access,
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
      setVoteStatus(state, access, "Your vote could not be stored locally, so it was not recorded.");
      return;
    }

    setVoteStatus(state, access, "Thanks—your local visitor vote was recorded.");
    trackVoteEvent("patreon_feature_vote", {
      feature_id: feature.id,
      vote_direction: direction,
      vote_weight: 1,
      ...getAccessParameters(access),
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

function renderFeatureList(features, serverTotals, state, access) {
  const featureList = document.querySelector("#feature-list");
  const previousPositions = new Map(
    Array.from(featureList.children, (item) => [item.dataset.featureId, item.getBoundingClientRect()]),
  );
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

    item.dataset.featureId = feature.id;
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
      createVoteButton("up", feature, state, serverTotals, access, () => {
        renderFeatureList(features, serverTotals, state, access);
      }),
      createVoteButton("down", feature, state, serverTotals, access, () => {
        renderFeatureList(features, serverTotals, state, access);
      }),
    );
    votePanel.append(voteTotals, actions);
    article.append(content, votePanel);
    item.append(article);
    fragment.append(item);
  }

  featureList.replaceChildren(fragment);
  animateFeatureReorder(featureList, previousPositions);
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
  let access = { authenticated: false, membershipTier: null };
  let sessionUnavailable = false;

  try {
    access = await loadPatreonSession();
  } catch {
    sessionUnavailable = true;
  }
  updateAccessUi(access);
  updateSuggestionUi(access);

  if (!voteState) {
    document.querySelector("#vote-status").textContent = (
      "Voting is unavailable because this browser cannot store your weekly allowance."
    );
    trackVoteEvent("patreon_feature_vote_storage_unavailable", getAccessParameters(access));
    return;
  }

  setVoteStatus(
    voteState,
    access,
    sessionUnavailable
      ? "Patreon login status is temporarily unavailable. Visitor voting is still available."
      : undefined,
  );

  try {
    const [catalog, totals] = await Promise.all([
      loadJson(featureCatalogUrl),
      loadJson(voteTotalsUrl),
    ]);
    const features = Array.isArray(catalog.features) ? catalog.features : [];
    if (!features.length) {
      throw new Error("Feature catalog is empty.");
    }

    renderFeatureList(features, totals.features || {}, voteState, access);
  } catch {
    document.querySelector("#feature-list").textContent = (
      "Feature requests are temporarily unavailable. Please try again later."
    );
    setVoteStatus(voteState, access, "Voting is temporarily unavailable.");
    return;
  }

  if (recoveredInvalidVoteState) {
    setVoteStatus(
      voteState,
      access,
      "Your saved visitor allowance could not be read, so it has been reset for this week.",
    );
  }
  trackVoteEvent("patreon_feature_board_viewed", getAccessParameters(access));
}, { once: true });
