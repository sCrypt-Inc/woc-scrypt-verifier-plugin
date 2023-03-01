import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from "react-router-dom";
import configDefault from './configDefault.json'
import GridLoader from "react-spinners/GridLoader";

import Entry from './Entry';
import New from './New';

import './App.css';

function App() {
  const { network, scriptHash } = useParams();

  const query = new URLSearchParams(useLocation().search);

  const [apiResp, setDataApiResp] = useState(undefined as any);

  const apiURL = (process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL)
    + `/${network}/${scriptHash}`

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(apiURL, { mode: 'cors' });
      if (response.ok) {
        const jsonData = await response.json();
        setDataApiResp({
          ok: response.ok,
          status: response.status,
          data: jsonData
        });
      } else {
        setDataApiResp({
          ok: response.ok,
          status: response.status,
          data: {}
        });
      }
    };
    fetchData();
  }, []);

  const loadCssOverride = {
    "display": "block",
    "margin-left": "auto",
    "margin-right": "auto",
  }

  if (query.get('new') == 'true') {
    return (<New />);
  } else {
    return (
      <div className='mainDiv'>
        {apiResp
          ? <>
            {apiResp.ok
              ? <Entry entryList={apiResp.data} />
              : <New />
            }
          </>
          :
          <GridLoader
            color={'#6976d9'}
            loading={true}
            //cssOverride={override}
            size={10}
            aria-label="Loading Spinner"
            data-testid="loader"
            cssOverride={loadCssOverride}
          />

        }
      </div>
    );
  }
}

export default App;
