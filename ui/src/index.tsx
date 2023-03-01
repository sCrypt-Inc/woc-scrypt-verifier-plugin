import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import './index.css';
import App from './App';
import Err from './Err';
import reportWebVitals from './reportWebVitals';

// TODO: Instead of "this app is using react..." just respond with simple 404
//       When accessing invalid link.

const router = createBrowserRouter([
  {
    path: "/:network/:scriptHash",
    element: <App />,
    errorElement: <Err />
  },
]);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
