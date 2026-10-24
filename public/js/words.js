// Secret words, grouped by category (17 each, so a 16-word grid always fits). Family friendly, single concepts everyone knows.
export const GRID_SIZE = 16;
export const WORDS = {
  Places: ['Beach', 'Library', 'Hospital', 'Airport', 'Museum', 'Zoo', 'Bakery', 'Castle', 'Cinema', 'School', 'Farm', 'Lighthouse', 'Playground', 'Supermarket', 'Stadium', 'Pharmacy', 'Harbor'],
  Food: ['Pizza', 'Pancakes', 'Sushi', 'Popcorn', 'Spaghetti', 'Burger', 'Ice Cream', 'Sandwich', 'Tacos', 'Cheese', 'Watermelon', 'Cupcake', 'Soup', 'Chocolate', 'Noodles', 'Salad', 'Pretzel'],
  Animals: ['Elephant', 'Penguin', 'Giraffe', 'Dolphin', 'Kangaroo', 'Owl', 'Octopus', 'Butterfly', 'Tiger', 'Rabbit', 'Turtle', 'Monkey', 'Shark', 'Parrot', 'Lion', 'Frog', 'Camel'],
  Jobs: ['Teacher', 'Firefighter', 'Chef', 'Pilot', 'Doctor', 'Astronaut', 'Farmer', 'Dentist', 'Detective', 'Plumber', 'Librarian', 'Mechanic', 'Photographer', 'Baker', 'Carpenter', 'Nurse', 'Singer'],
  Sports: ['Soccer', 'Basketball', 'Tennis', 'Swimming', 'Baseball', 'Golf', 'Surfing', 'Skiing', 'Boxing', 'Volleyball', 'Archery', 'Bowling', 'Gymnastics', 'Hockey', 'Cricket', 'Rugby', 'Badminton'],
  'Movie Genres': ['Western', 'Horror', 'Comedy', 'Musical', 'Romance', 'Documentary', 'Fantasy', 'Cartoon', 'Mystery', 'Superhero', 'Adventure', 'Science Fiction', 'Disaster', 'Fairy Tale', 'Thriller', 'Animation', 'Action'],
  Objects: ['Umbrella', 'Scissors', 'Backpack', 'Candle', 'Mirror', 'Telescope', 'Clock', 'Ladder', 'Balloon', 'Key', 'Pillow', 'Camera', 'Compass', 'Toothbrush', 'Lantern', 'Wallet', 'Hammer'],
  Weather: ['Rainbow', 'Thunderstorm', 'Snowstorm', 'Fog', 'Hurricane', 'Breeze', 'Drizzle', 'Heatwave', 'Tornado', 'Hail', 'Sunshine', 'Frost', 'Lightning', 'Blizzard', 'Rain', 'Snow', 'Monsoon'],
  Music: ['Guitar', 'Piano', 'Drums', 'Violin', 'Trumpet', 'Orchestra', 'Concert', 'Choir', 'Karaoke', 'Harmonica', 'Flute', 'Lullaby', 'Saxophone', 'Microphone', 'Banjo', 'Cello', 'Harp'],
  Holidays: ['Halloween', 'Christmas', 'Birthday', 'Easter', 'Thanksgiving', "Valentine's Day", "New Year's Eve", 'Diwali', 'Carnival', 'Hanukkah', 'Independence Day', 'Wedding', 'Eid', 'Lunar New Year', "Mother's Day", 'Groundhog Day', 'Kwanzaa'],
  Transport: ['Bicycle', 'Submarine', 'Helicopter', 'Train', 'Skateboard', 'Ferry', 'Rocket', 'Taxi', 'Motorcycle', 'Hot Air Balloon', 'Tractor', 'Scooter', 'Subway', 'Canoe', 'Bus', 'Sailboat', 'Airplane'],
  Nature: ['Volcano', 'Waterfall', 'Forest', 'Desert', 'Mountain', 'Island', 'Cave', 'River', 'Glacier', 'Jungle', 'Meadow', 'Canyon', 'Ocean', 'Swamp', 'Lake', 'Reef', 'Rainforest'],
};
export const CATEGORIES = Object.keys(WORDS);
export const ALL_WORDS = CATEGORIES.flatMap(c => WORDS[c].map(word => ({ category: c, word })));
