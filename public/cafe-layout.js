import { LANDMARKS, ROOM_LABELS, SEATS, WORLD, toPercent } from "./cafe-map.mjs";

const spaces = Object.fromEntries(Object.entries(ROOM_LABELS).map(([key, label]) => [key, {
  label,
  positions: SEATS.filter(({ space }) => space === key).map(({ foot }) => {
    const { x, y } = toPercent(foot);
    return [x, y];
  }),
}]));

window.cafeLayout = { world: WORLD, spaces, landmarks: LANDMARKS };
