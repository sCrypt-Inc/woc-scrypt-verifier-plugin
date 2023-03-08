import React, { useState, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useParams } from "react-router-dom";
import configDefault from './configDefault.json'
import GridLoader from "react-spinners/GridLoader";

import './App.css';
import { cursorTo } from 'readline';

const networks: string[] = ['main', 'test']

const apiURL = process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL;

function New() {
  const { network, scriptHash } = useParams();

  const [scryptTSVersionList, setScryptTSVersionList] = useState([] as string[]);
  const [scryptTSVersion, setSelectedOptionScryptTSVersion] = useState('');
  const [code, setCodeInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const apiSubmitURL = apiURL + `/${network}/${scriptHash}`


  useEffect(() => {
    const fetchLatestVersions = async () => {
      const packageName = 'scrypt-ts'
      const url = `https://registry.npmjs.org/${packageName}/`
      const response = await fetch(url)
      const data = await response.json()
      const versions = Object.keys(data.versions).reverse()

      let cutoffIdx = versions.length - 1
      versions.find((ver: string, idx: number) => {
        if (ver.startsWith('0.1.7-beta.6')) {
          cutoffIdx = idx
          return true
        }
        return false
      })
      setScryptTSVersionList(versions.slice(0, cutoffIdx))
      setSelectedOptionScryptTSVersion(versions[0])
    }
    fetchLatestVersions()
  }, []);

  const handleDropdownChangeScryptTSVersion = (event: any) => {
    setSelectedOptionScryptTSVersion(event.target.value);
  }

  const handleCodeChange = (event: any) => {
    setCodeInput(event.target.value);
  }


  const handleSubmit = async (event: any) => {
    event.preventDefault()

    setErrMsg('')
    setLoading(true)

    // TODO: Do a sanity check on all input data

    const payload = {
      code: code,
    }

    const response = await fetch(apiSubmitURL + '?ver=' + scryptTSVersion,
      {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(payload),
      })

    if (response.ok) {
      //const data = await response.json()
      window.location.href = `/${network}/${scriptHash}`;
    } else {
      setErrMsg(await response.text())
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mainDiv">
      <label>
        Select sCrypt version:<br />
        <select value={scryptTSVersion} onChange={handleDropdownChangeScryptTSVersion}>
          {
            (() => {
              let container: any = [];
              scryptTSVersionList.forEach((val: any) => {
                container.push(
                  <option key={val} value={val}>
                    {val}
                  </option>)
              });
              return container;
            })()
          }
        </select>
      </label>
      <br />
      <label>
        Enter smart contract code: <br />
        <TextareaAutosize
          className='textInput'
          minRows={10}
          maxRows={30}
          onChange={handleCodeChange}
        />
      </label>
      <br />
      <button className='submitButton' type="submit">Submit</button>
      <br />
      <GridLoader
        color={'#6976d9'}
        loading={loading}
        //cssOverride={override}
        size={10}
        aria-label="Loading Spinner"
        data-testid="loader"
      />
      {errMsg && <div className='error'>{errMsg}</div>}
    </form>
  );
}

export default New;
