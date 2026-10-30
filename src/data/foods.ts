// Bundled reference of common staple foods. Values are APPROXIMATE (typical serving, rounded)
// and are meant for quick logging, not medical or dietary precision. Works fully offline.
export interface RefFood {
  name: string
  serving: string
  kcal: number
  protein: number
}

// name | serving | kcal | protein g
const RAW: [string, string, number, number][] = [
  // Eggs & dairy
  ['Egg, large', '1 egg', 70, 6], ['Egg whites', '3 large', 50, 11], ['Whole milk', '1 cup', 150, 8], ['2% milk', '1 cup', 120, 8], ['Skim milk', '1 cup', 85, 8],
  ['Almond milk, unsweetened', '1 cup', 35, 1], ['Oat milk', '1 cup', 120, 3], ['Greek yogurt, plain nonfat', '170 g', 100, 17], ['Greek yogurt, plain whole', '170 g', 165, 15],
  ['Yogurt, flavored', '170 g', 150, 6], ['Cottage cheese, low fat', '1/2 cup', 90, 12], ['Cheddar cheese', '1 oz', 115, 7], ['Mozzarella cheese', '1 oz', 85, 6],
  ['Parmesan cheese', '2 tbsp', 45, 4], ['Cream cheese', '2 tbsp', 100, 2], ['Butter', '1 tbsp', 100, 0], ['Heavy cream', '1 tbsp', 50, 0], ['Sour cream', '2 tbsp', 60, 1],
  ['Ice cream, vanilla', '1/2 cup', 140, 2],
  // Meat & fish
  ['Chicken breast, cooked', '100 g', 165, 31], ['Chicken thigh, cooked', '100 g', 210, 26], ['Ground beef 85% lean, cooked', '100 g', 250, 26], ['Ground turkey, cooked', '100 g', 200, 27],
  ['Steak, sirloin cooked', '100 g', 210, 29], ['Pork chop, cooked', '100 g', 230, 27], ['Bacon', '2 slices', 90, 6], ['Sausage, pork link', '2 links', 180, 8], ['Ham, sliced', '2 oz', 60, 10],
  ['Deli turkey', '2 oz', 50, 10], ['Hot dog', '1 frank', 150, 5], ['Salmon, cooked', '100 g', 205, 22], ['Tuna, canned in water', '1 can (140 g)', 120, 26], ['Shrimp, cooked', '100 g', 100, 24],
  ['Cod, cooked', '100 g', 105, 23], ['Tilapia, cooked', '100 g', 130, 26],
  // Plant protein
  ['Tofu, firm', '100 g', 145, 15], ['Tempeh', '100 g', 190, 20], ['Black beans, cooked', '1/2 cup', 115, 8], ['Chickpeas, cooked', '1/2 cup', 135, 7], ['Lentils, cooked', '1/2 cup', 115, 9],
  ['Kidney beans, cooked', '1/2 cup', 110, 8], ['Refried beans', '1/2 cup', 120, 7], ['Hummus', '2 tbsp', 70, 2], ['Edamame', '1/2 cup', 95, 9],
  // Nuts & spreads
  ['Peanut butter', '2 tbsp', 190, 7], ['Almond butter', '2 tbsp', 195, 7], ['Almonds', '1 oz', 165, 6], ['Peanuts', '1 oz', 160, 7], ['Walnuts', '1 oz', 185, 4], ['Cashews', '1 oz', 160, 4],
  ['Sunflower seeds', '1 oz', 165, 6], ['Chia seeds', '1 tbsp', 60, 2], ['Trail mix', '1/4 cup', 170, 5],
  // Grains & bread
  ['White rice, cooked', '1 cup', 205, 4], ['Brown rice, cooked', '1 cup', 215, 5], ['Quinoa, cooked', '1 cup', 220, 8], ['Pasta, cooked', '1 cup', 220, 8], ['Whole wheat pasta, cooked', '1 cup', 175, 7],
  ['Oatmeal, cooked', '1 cup', 150, 5], ['Rolled oats, dry', '1/2 cup', 150, 5], ['Granola', '1/2 cup', 220, 5], ['Cereal, corn flakes', '1 cup', 100, 2], ['Cheerios', '1 cup', 100, 3],
  ['White bread', '1 slice', 75, 2], ['Whole wheat bread', '1 slice', 80, 4], ['Bagel, plain', '1 medium', 280, 11], ['English muffin', '1 muffin', 130, 5], ['Tortilla, flour', '1 medium', 140, 4],
  ['Tortilla, corn', '1 small', 55, 1], ['Pita bread', '1 pita', 165, 5], ['Pancakes', '2 medium', 190, 5], ['Waffle', '1 waffle', 220, 6], ['Croissant', '1 medium', 230, 5],
  ['Crackers, saltine', '5 crackers', 60, 1], ['Tortilla chips', '1 oz', 140, 2], ['Potato chips', '1 oz', 155, 2], ['Popcorn, air-popped', '3 cups', 95, 3], ['Pretzels', '1 oz', 110, 3],
  ['Granola bar', '1 bar', 120, 2], ['Protein bar', '1 bar', 200, 20],
  // Vegetables
  ['Potato, baked', '1 medium', 160, 4], ['Sweet potato, baked', '1 medium', 110, 2], ['French fries', 'medium serving', 365, 4], ['Broccoli, cooked', '1 cup', 55, 4], ['Spinach, raw', '2 cups', 14, 2],
  ['Carrots', '1 medium', 25, 1], ['Cucumber', '1/2 cup', 8, 0], ['Tomato', '1 medium', 22, 1], ['Lettuce, romaine', '2 cups', 16, 1], ['Bell pepper', '1 medium', 30, 1],
  ['Onion', '1/2 cup', 32, 1], ['Mushrooms', '1 cup', 15, 2], ['Green beans', '1 cup', 35, 2], ['Corn, cooked', '1/2 cup', 90, 3], ['Peas, green', '1/2 cup', 60, 4],
  ['Cauliflower', '1 cup', 27, 2], ['Zucchini', '1 cup', 20, 1], ['Avocado', '1/2 fruit', 160, 2], ['Salad, side garden', '1 bowl', 40, 2],
  // Fruit
  ['Apple', '1 medium', 95, 0], ['Banana', '1 medium', 105, 1], ['Orange', '1 medium', 62, 1], ['Strawberries', '1 cup', 50, 1], ['Blueberries', '1 cup', 85, 1], ['Grapes', '1 cup', 100, 1],
  ['Watermelon', '1 cup', 45, 1], ['Pineapple', '1 cup', 80, 1], ['Mango', '1 cup', 100, 1], ['Pear', '1 medium', 100, 1], ['Peach', '1 medium', 60, 1], ['Raisins', '1/4 cup', 120, 1],
  ['Orange juice', '1 cup', 110, 2], ['Apple juice', '1 cup', 115, 0],
  // Drinks
  ['Coffee, black', '1 cup', 2, 0], ['Latte', '12 oz', 150, 8], ['Tea, unsweetened', '1 cup', 2, 0], ['Cola', '12 oz can', 140, 0], ['Beer', '12 oz', 150, 1], ['Wine, red', '5 oz', 125, 0],
  ['Protein shake', '1 scoop + water', 120, 24], ['Whey protein powder', '1 scoop', 120, 24], ['Sports drink', '20 oz', 130, 0],
  // Meals & fast food (rough)
  ['Cheese pizza', '1 slice', 285, 12], ['Pepperoni pizza', '1 slice', 310, 13], ['Cheeseburger', '1 sandwich', 450, 25], ['Hamburger', '1 sandwich', 350, 20], ['Chicken sandwich', '1 sandwich', 440, 28],
  ['Chicken nuggets', '6 pieces', 270, 14], ['Burrito, bean and cheese', '1 burrito', 380, 14], ['Chicken burrito bowl', '1 bowl', 650, 40], ['Taco, beef', '1 taco', 170, 8],
  ['Sub sandwich, turkey', '6 inch', 280, 18], ['Grilled cheese', '1 sandwich', 370, 14], ['PB&J sandwich', '1 sandwich', 370, 12], ['Caesar salad with chicken', '1 bowl', 400, 30],
  ['Spaghetti with meat sauce', '1.5 cups', 400, 20], ['Mac and cheese', '1 cup', 350, 12], ['Fried rice', '1 cup', 240, 6], ['Chicken soup', '1 cup', 75, 5], ['Chili with beans', '1 cup', 250, 16],
  ['Sushi roll, California', '6 pieces', 255, 9], ['Burrito, chicken', '1 large', 600, 30], ['Frozen dinner', '1 meal', 320, 14], ['Instant ramen', '1 pack', 380, 8],
  // Sweets, oils, condiments
  ['Chocolate bar', '1.5 oz', 210, 3], ['Dark chocolate', '1 oz', 170, 2], ['Cookie, chocolate chip', '1 medium', 160, 2], ['Donut, glazed', '1 donut', 250, 3], ['Brownie', '1 square', 230, 3],
  ['Muffin, blueberry', '1 medium', 380, 5], ['Cake slice', '1 slice', 350, 4], ['Honey', '1 tbsp', 60, 0], ['Sugar', '1 tsp', 16, 0], ['Maple syrup', '1 tbsp', 52, 0],
  ['Jam', '1 tbsp', 50, 0], ['Olive oil', '1 tbsp', 120, 0], ['Mayonnaise', '1 tbsp', 90, 0], ['Ketchup', '1 tbsp', 20, 0], ['Ranch dressing', '2 tbsp', 130, 0], ['Salsa', '2 tbsp', 10, 0],
]

export const FOODS: RefFood[] = RAW.map(([name, serving, kcal, protein]) => ({ name, serving, kcal, protein }))

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Ranks the bundled foods against a query: exact, prefix, word-prefix, then all-words-contained. */
export function searchFoods(query: string, limit = 6, foods: RefFood[] = FOODS): RefFood[] {
  const q = norm(query)
  if (q.length < 2) return []
  const words = q.split(' ')
  const scored: { f: RefFood; score: number }[] = []
  for (const f of foods) {
    const n = norm(f.name)
    const nw = n.split(' ')
    let score = 0
    if (n === q) score = 100
    else if (n.startsWith(q)) score = 80
    else if (nw.some((w) => w.startsWith(q))) score = 60
    else if (words.every((w) => nw.some((x) => x.startsWith(w)))) score = 50
    else if (n.includes(q)) score = 40
    if (score) scored.push({ f, score: score - Math.min(n.length, 40) / 100 })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.f)
}
