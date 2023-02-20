import React, { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useParams } from "react-router-dom";
import configDefault from './configDefault.json'

import './App.css';

const networks: string[] = ['main', 'test']

// TODO: Fill dynamically.
const scryptTSVersions: string[] = [
  '0.1.6-beta.7'
]

const apiURL = process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL;

function New() {
  const { network, txid, voutIdx } = useParams();

  const [scryptTSVersion, setSelectedOptionScryptTSVersion] = useState('');
  const [code, setCodeInput] = useState('');
  const [abiConstructorParams, setAbiParamsInput] = useState(['']);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const apiSubmitURL = apiURL + `/${network}/${txid}/${voutIdx}`

  const handleDropdownChangeScryptTSVersion = (event: any) => {
    setSelectedOptionScryptTSVersion(event.target.value);
  }

  const handleCodeChange = (event: any) => {
    setCodeInput(event.target.value);
  }

  const handleAbiParamsChange = (event: any) => {
    const rawVal: string = event.target.value
    if (rawVal.match(/[^a-fA-F0-9",\s\[\]]+/) || rawVal.length % 2 != 0) {
      // TODO: Highlight syntax err.
      return
    }
    let res: string[] = rawVal.toLowerCase().replaceAll(/[",\[\]]+/g, ' ').split(/\s+/).filter(
      (val: string) => val.trim() !== ''
    )
    setAbiParamsInput(res)
  }

  const handleSubmit = async (event: any) => {
    event.preventDefault();

    setLoading(true);

    // TODO: Do a sanity check on all input data

    const payload = {
      code: code,
      abiConstructorParams: abiConstructorParams
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
      window.location.href = `/${network}/${txid}/${voutIdx}`;
    } else {
      setErrMsg(await response.text())
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Select scrypt-ts version:
        <select value={scryptTSVersion} onChange={handleDropdownChangeScryptTSVersion}>
          {
            (() => {
              let container: any = [];
              scryptTSVersions.forEach((val: any) => {
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
          style={{ width: '500px' }}
          minRows={10}
          onChange={handleCodeChange}
        />
      </label>
      <br />
      <label>
        Enter ABI-encoded constructor parameters: <br />
        <TextareaAutosize // TODO: Add hint
          style={{ width: '300px' }}
          minRows={1}
          onChange={handleAbiParamsChange}
        />
      </label>
      <br />
      <button type="submit">Submit</button>
      <br />
      {loading && <p>Loading...</p>}
      {errMsg && <p>{errMsg}</p>}
    </form>
  );
}

export default New;
