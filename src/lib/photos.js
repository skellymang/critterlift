// Public-domain photos from the U.S. Fish & Wildlife Service media library
// (fws.gov/media). Free to use; credits are shown in the app.
const FWS = 'https://www.fws.gov/sites/default/files/styles/max_1300x1300/public';

export const PHOTOS = {
  hands: {
    src: `${FWS}/2022-01/DSC_0367.jpg?itok=98xrPdbB`,
    alt: 'A small burrowing owl held gently in gloved hands',
    credit: 'Aubry Buzek/USFWS',
  },
  exam: {
    src: `${FWS}/2021-05/34889121785_8b40852da6_o.jpg?itok=c-CQTDu0`,
    alt: 'An osprey chick being checked for injuries by a wildlife rehabilitator',
    credit: 'Courtney Celley/USFWS',
  },
  herons: {
    src: `${FWS}/images/2019-03/32802.jpg?itok=9mPz9mPc`,
    alt: 'Fledgling black-crowned night herons',
    credit: 'Grayson Smith/USFWS',
  },
  fawn: {
    src: `${FWS}/2022-02/white-tail-deer-fawn-sand-lake-nwr-tom-koerner-usfws.jpg?itok=F97OQHgt`,
    alt: 'A white-tailed fawn lying still in the grass, left alone but not orphaned',
    credit: 'Tom Koerner/USFWS',
  },
  killdeer: {
    src: `${FWS}/images/2024-03-5/18626.jpg?itok=M5WdSjdT`,
    alt: 'A killdeer chick, able to run and feed itself from the day it hatches',
    credit: 'USFWS',
  },
  healing: {
    src: `${FWS}/2023-08/short-tailed%20hawk%20is%20admitted%20into%20rehab.%20courtesy%20of%20samantha%20little%20Audubon%20Center%20for%20Birds%20of%20Prey.jpg?itok=TDXoTQmv`,
    alt: 'A short-tailed hawk in rehab with one wing bandaged',
    credit: 'Samantha Little/Audubon Center for Birds of Prey',
  },
  screechOwl: {
    src: `${FWS}/2023-08/Sanford%20eastern%20screech%20owl.%20Courtesy%20of%20Beth%20Lott%20Audubon%20Center%20for%20Birds%20of%20Prey.jpeg?itok=6vTIhD7w`,
    alt: 'An eastern screech owl in the care of a rehabilitation centre',
    credit: 'Beth Lott/Audubon Center for Birds of Prey',
  },
  release: {
    src: `${FWS}/2022-01/DSC_0363.jpg?itok=jsZUrAev`,
    alt: 'A volunteer carries a rehabilitated burrowing owl to its release site in South Texas',
    credit: 'Aubry Buzek/USFWS',
  },
  ospreyRelease: {
    src: `${FWS}/2023-08/rehabber%20releases%20osprey%20back%20into%20wild.%20Courtesy%20of%20Samantha%20Little%20Audubon%20Center%20for%20Birds%20of%20Prey.jpg?itok=FBYPOh1u`,
    alt: 'A rehabber releases an osprey back into the wild after nearly two years of recovery',
    credit: 'Samantha Little/Audubon Center for Birds of Prey',
  },
  pelicanRelease: {
    src: `${FWS}/images/2010-05/10589.jpg?itok=GjpVtfd-`,
    alt: 'A wildlife veterinarian and a refuge manager release a recovered pelican',
    credit: 'Nick Wirwa/USFWS',
  },
  condorRelease: {
    src: `${FWS}/images/2014-06/19880.jpg?itok=cZ-cnIcw`,
    alt: 'Two people release a California condor back into its home range after treatment',
    credit: 'Jon Myatt/USFWS',
  },
  duckRelease: {
    src: `${FWS}/2022-09/Duck%20release.USFWS_.JPG?itok=aIGCBw6_`,
    alt: 'Biologists release ducks back into the wild',
    credit: 'USFWS',
  },
};

// Which photos go where on the landing page. No photo is used twice.
export const HERO_PHOTOS = [PHOTOS.hands, PHOTOS.exam, PHOTOS.herons];
export const STEP_PHOTOS = [
  [PHOTOS.fawn, PHOTOS.killdeer],        // 1. does it need you at all?
  [PHOTOS.healing, PHOTOS.screechOwl],   // 2. a volunteer gets it to a rehabber
  [PHOTOS.release, PHOTOS.ospreyRelease], // 3. back home
];

// Volunteer sign-up: none of these appear on the landing page.
export const VOLUNTEER_PHOTOS = [PHOTOS.pelicanRelease, PHOTOS.condorRelease, PHOTOS.duckRelease];

export const PHOTO_CREDITS =
  'Photos: U.S. Fish & Wildlife Service media library, public domain. ' +
  [...new Set(Object.values(PHOTOS).map((p) => p.credit))].join('; ') + '.';
