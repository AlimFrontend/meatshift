/**
 * upgradeSystem.js — апгрейды между волнами: список, выбор 3 из 5, применение.
 */

import { UPGRADE_LIST } from "./config.js";

let showUpgradeScreen = false;
let upgradeScreenOpened = false;

export function isUpgradeScreenVisible() {
  return showUpgradeScreen;
}
export function setUpgradeScreenVisible(v) {
  showUpgradeScreen = v;
}
export function isUpgradeScreenOpened() {
  return upgradeScreenOpened;
}
export function setUpgradeScreenOpened(v) {
  upgradeScreenOpened = v;
}

export function openUpgradeScreen(player, onOpenSound, onApplied) {
  const container = document.getElementById("upgradeButtons");
  if (!container) return;
  container.innerHTML = "";
  let pool = UPGRADE_LIST.filter(
    (u) =>
      u.id !== "cooldown" ||
      (player.cooldownReductions || 0) < (u.maxPicks || 999)
  );
  pool = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  pool.forEach((u) => {
    const btn = document.createElement("button");
    btn.textContent = u.label;
    btn.onclick = () => applyUpgrade(u.id, player, onApplied);
    container.appendChild(btn);
  });
  document.getElementById("upgradeScreen")?.classList.add("visible");
  upgradeScreenOpened = true;
  showUpgradeScreen = true;
  onOpenSound?.();
}

export function applyUpgrade(id, player, onApplied) {
  if (id === "cooldown") {
    if ((player.cooldownReductions || 0) < 2)
      player.cooldownReductions = (player.cooldownReductions || 0) + 1;
  } else if (player.upgrades[id] !== undefined) {
    player.upgrades[id]++;
  }
  if (id === "maxHp") {
    player.maxHp = Math.round(
      player.baseMaxHp * Math.pow(1.1, player.upgrades.maxHp)
    );
  }
  showUpgradeScreen = false;
  document.getElementById("upgradeScreen")?.classList.remove("visible");
  onApplied?.(id);
}
