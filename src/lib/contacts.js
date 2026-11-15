// Real organizations a finder in Austin can contact. Checked 2026-11-15 against
// the City of Austin wildlife page (austintexas.gov/page/wildlife) and the Texas
// Parks and Wildlife rehabilitator list. Never let the AI fill these in.
export const CONTACTS = [
  {
    id: 'awr',
    name: 'Austin Wildlife Rescue',
    what: 'Licensed wildlife rehabbers. Call for advice, or to arrange bringing the animal in.',
    phone: '512-472-9453',
    tel: '+15124729453',
    note: 'The hotline is often voicemail: leave your name, number and what you found, and they call back. Drop-off is 9am to 4pm daily; ask for the current address when you call.',
    wildlife: true,
  },
  {
    id: 'aas',
    name: 'Austin Animal Services (call 3-1-1)',
    what: 'Call to have a city officer come and collect sick or injured wildlife and take it to Austin Wildlife Rescue.',
    phone: '3-1-1',
    tel: '311',
    altPhone: '512-974-2000',
    altTel: '+15129742000',
    messageUrl: 'https://311.austintexas.gov/',
    messageLabel: 'Report it online to 3-1-1',
    note: 'Use this for bats on the ground, raccoons, skunks, foxes and coyotes, or if you cannot safely contain the animal.',
    wildlife: true,
    bestForRabies: true,
  },
  {
    id: 'apa',
    name: 'Austin Pets Alive!',
    what: 'A pet rescue for dogs and cats. It does not take wild animals.',
    url: 'https://www.austinpetsalive.org/',
    note: 'Only use this if the animal turns out to be a pet.',
    wildlife: false,
  },
];
