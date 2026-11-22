/* DynamiteOrbit — public configuration. NO SECRET HERE: an OAuth « Web application » client ID is public by nature
   (it only works from the JavaScript origins declared for it in the Google Cloud console). See docs/GOOGLE.md. */

export const CONFIG = Object.freeze({
  /* OAuth 2.0 client ID (…apps.googleusercontent.com). Empty = Google sign-in is off: the hosted demo stays closed,
     the local server works without any account. This is the client of the owner's Google Cloud project, shared with
     SuperChef.ai (same origin https://jpdesbiens11.github.io): the consent screen shows that project's name. */
  clientId: "437109324574-b0kdk554tldhsj1gjllnhu42m1gueorr.apps.googleusercontent.com",
  /* Smallest useful scopes: who signs in (e-mail), and the files THIS app creates in the user's Drive — nothing else. */
  scopes: "openid email https://www.googleapis.com/auth/drive.file",
  driveRoot: "DynamiteOrbit.ai",                 // name of the root folder created in the user's Drive
  /* Browser API key for the Google file picker (Équipe : reading the mirror another member shared). Optional : the
     picker is given the signed-in person's token and the project number. Fill it only if Google asks for it ; such a
     key is public by nature and must be restricted, in the Cloud console, to this site and to the Picker API. */
  pickerKey: "",
  accessFile: "acces.json",                     // approved accounts of the hosted demo (hashes only, see core/access.js)
  repo: "jpdesbiens11/DynamiteOrbit",         // where access requests and feedback are filed
});
