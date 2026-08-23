import axios from "axios";

/**
 * Axios singleton for the public portal.
 *
 * Deliberately much thinner than the internal app's client: every endpoint this
 * app touches is unauthenticated, so there is no token to attach and no refresh
 * interceptor to run. Nothing here should ever send credentials — if a page
 * needs authenticated data, that is a signal the endpoint belongs on the
 * internal app instead.
 */
const djangoClient = () => {
  const host =
    typeof window === "undefined"
      ? (process.env.DJANGO_API_URL ?? "http://localhost:8000")
      : (process.env.NEXT_PUBLIC_DJANGO_API_URL ?? "http://localhost:8000");

  return axios.create({
    baseURL: `${host}/api/v1`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
};

export default djangoClient();
