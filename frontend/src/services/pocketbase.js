import PocketBase from "pocketbase";
const baseUrl = import.meta.env.VITE_PB_URL;
const pb = new PocketBase(baseUrl);

export default pb;