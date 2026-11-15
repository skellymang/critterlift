export const AUSTIN = { lat: 30.2672, lng: -97.7431 };

// Keep in sync with ANIMAL_TYPES in api/triage.js and species_ok in the database.
export const ANIMAL_TYPES = [
  { id: 'bird', label: 'Birds' },
  { id: 'small_mammal', label: 'Small mammals (squirrels, rabbits, opossums)' },
  { id: 'rabies_vector', label: 'Bats, raccoons, skunks, foxes (trained only)' },
  { id: 'deer', label: 'Deer and fawns' },
  { id: 'reptile', label: 'Turtles, snakes, lizards' },
  { id: 'amphibian', label: 'Frogs and toads' },
  { id: 'other', label: 'Anything else' },
];

export const VERDICT_TEXT = {
  leave_it: { title: 'Leave it', tone: 'ok', blurb: 'This looks normal. The animal most likely does not need you.' },
  watch: { title: 'Watch it', tone: 'warn', blurb: 'Keep your distance and check again in a few hours.' },
  needs_help: { title: 'Needs help now', tone: 'bad', blurb: 'This animal likely needs a licensed rehabber.' },
};

export const STATUS_TEXT = {
  open: 'Looking for a volunteer…',
  accepted: 'A volunteer is on the way',
  picked_up: 'Picked up, heading to the rehab',
  delivered: 'Delivered to the rehab. Thank you!',
};

export const FIRE_NEAR_KM = 5;      // a report this close to a fire gets tagged
export const FIRE_ZONE_M = 2000;    // "Check here" circle radius
