import { useRouteError, isRouteErrorResponse } from "react-router-dom";

function Err() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <p>{error.status} {error.statusText}</p>
  }

  return <p>{"Unknown Error"}</p>
}

export default Err;
