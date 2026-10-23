// Secret words, grouped by category. Family friendly, single concepts everyone knows.
export const WORDS = {
  Places: ['Beach', 'Library', 'Hospital', 'Airport', 'Museum', 'Zoo', 'Bakery', 'Castle', 'Cinema', 'School', 'Farm', 'Lighthouse', 'Playground', 'Supermarket'],
  Food: ['Pizza', 'Pancakes', 'Sushi', 'Popcorn', 'Spaghetti', 'Burger', 'Ice Cream', 'Sandwich', 'Tacos', 'Cheese', 'Watermelon', 'Cupcake', 'Soup', 'Chocolate'],
  Animals: ['Elephant', 'Penguin', 'Giraffe', 'Dolphin', 'Kangaroo', 'Owl', 'Octopus', 'Butterfly', 'Tiger', 'Rabbit', 'Turtle', 'Monkey', 'Shark', 'Parrot'],
  Jobs: ['Teacher', 'Firefighter', 'Chef', 'Pilot', 'Doctor', 'Astronaut', 'Farmer', 'Dentist', 'Detective', 'Plumber', 'Librarian', 'Mechanic', 'Photographer', 'Baker'],
  Sports: ['Soccer', 'Basketball', 'Tennis', 'Swimming', 'Baseball', 'Golf', 'Surfing', 'Skiing', 'Boxing', 'Volleyball', 'Archery', 'Bowling', 'Gymnastics', 'Hockey'],
  'Movie Genres': ['Western', 'Horror', 'Comedy', 'Musical', 'Romance', 'Documentary', 'Fantasy', 'Cartoon', 'Mystery', 'Superhero', 'Adventure', 'Science Fiction', 'Disaster', 'Fairy Tale'],
  Objects: ['Umbrella', 'Scissors', 'Backpack', 'Candle', 'Mirror', 'Telescope', 'Clock', 'Ladder', 'Balloon', 'Key', 'Pillow', 'Camera', 'Compass', 'Toothbrush'],
  Weather: ['Rainbow', 'Thunderstorm', 'Snowstorm', 'Fog', 'Hurricane', 'Breeze', 'Drizzle', 'Heatwave', 'Tornado', 'Hail', 'Sunshine', 'Frost', 'Lightning', 'Blizzard'],
  Music: ['Guitar', 'Piano', 'Drums', 'Violin', 'Trumpet', 'Orchestra', 'Concert', 'Choir', 'Karaoke', 'Harmonica', 'Flute', 'Lullaby', 'Saxophone', 'Microphone'],
  Holidays: ['Halloween', 'Christmas', 'Birthday', 'Easter', 'Thanksgiving', "Valentine's Day", "New Year's Eve", 'Diwali', 'Carnival', 'Hanukkah', 'Independence Day', 'Wedding', 'Eid', 'Lunar New Year'],
  Transport: ['Bicycle', 'Submarine', 'Helicopter', 'Train', 'Skateboard', 'Ferry', 'Rocket', 'Taxi', 'Motorcycle', 'Hot Air Balloon', 'Tractor', 'Scooter', 'Subway', 'Canoe'],
  Nature: ['Volcano', 'Waterfall', 'Forest', 'Desert', 'Mountain', 'Island', 'Cave', 'River', 'Glacier', 'Jungle', 'Meadow', 'Canyon', 'Ocean', 'Swamp'],
};
export const CATEGORIES = Object.keys(WORDS);
export const ALL_WORDS = CATEGORIES.flatMap(c => WORDS[c].map(word => ({ category: c, word })));
