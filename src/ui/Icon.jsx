import bolt from "../assets/icons/bolt.svg?raw";
import clock from "../assets/icons/clock.svg?raw";
import ban from "../assets/icons/ban.svg?raw";
import circleCheck from "../assets/icons/circle-check.svg?raw";
import circleX from "../assets/icons/circle-x.svg?raw";
import chevronDown from "../assets/icons/chevron-down.svg?raw";
import x from "../assets/icons/x.svg?raw";
import trash from "../assets/icons/trash.svg?raw";
import braces from "../assets/icons/braces.svg?raw";
import restore from "../assets/icons/restore.svg?raw";
import upload from "../assets/icons/upload.svg?raw";
import download from "../assets/icons/download.svg?raw";
import fileDescription from "../assets/icons/file-description.svg?raw";
import pencil from "../assets/icons/pencil.svg?raw";
import search from "../assets/icons/search.svg?raw";
import filter from "../assets/icons/filter.svg?raw";
import listDetails from "../assets/icons/list-details.svg?raw";

// These are fixed, locally bundled Tabler SVGs. Never add user-supplied markup here.
const icons = {
  bolt,
  clock,
  ban,
  "circle-check": circleCheck,
  "circle-x": circleX,
  "chevron-down": chevronDown,
  x,
  trash,
  braces,
  restore,
  upload,
  download,
  "file-description": fileDescription,
  pencil,
  search,
  filter,
  "list-details": listDetails,
};

export function iconMarkup(name) {
  return icons[name] ?? "";
}

export function Icon(props) {
  return (
    <span
      class={`ui-icon${props.size ? ` ui-icon--${props.size}` : ""}${props.class ? ` ${props.class}` : ""}`}
      aria-hidden="true"
      innerHTML={iconMarkup(props.name)}
    />
  );
}
