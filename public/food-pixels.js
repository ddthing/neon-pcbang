const packFoods = { cola: "soda_coke", pastry: "pastry_brioche", peach: "jam_peach", cheese: "cake_cheese", cider: "soda_sprite" };
const originals = new Set([
  "jjagyechi", "rabokki", "spammayo", "chickenmayo", "ramyeon", "rice", "dumplings", "curry",
  "skewer", "hotdog", "tornado", "cheeseball", "menbosha", "fries", "toast", "bungeoppang",
  "eolbaksa", "ashatchu", "tea", "misutgaru", "beads", "coffee", "corner-ade",
]);

export function setFoodPixel(element, itemId) {
  const packSprite = Object.hasOwn(packFoods, itemId) ? packFoods[itemId] : null;
  const hasOriginal = originals.has(itemId);
  const path = hasOriginal ? "original/food/" + itemId : "foods/" + (packSprite ?? "onigiri_1");
  element.style.setProperty("--food-pixel", 'url("./assets/' + path + '.png")');
  element.setAttribute("aria-hidden", "true");
  element.toggleAttribute("data-original-pixel", hasOriginal);
}
