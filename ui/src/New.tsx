import React, { useState, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useParams } from "react-router-dom";
import configDefault from './configDefault.json'
import GridLoader from "react-spinners/GridLoader";

import './App.css';

const networks: string[] = ['main', 'test']

const apiURL = process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL;

function New() {
  const { network, txid, voutIdx } = useParams();

  const [scryptTSVersionList, setScryptTSVersionList] = useState([] as string[]);
  const [scryptTSVersion, setSelectedOptionScryptTSVersion] = useState('');
  const [code, setCodeInput] = useState('');
  const [abiConstructorParams, setAbiParamsInput] = useState([] as string[]);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const apiSubmitURL = apiURL + `/${network}/${txid}/${voutIdx}`


  useEffect(() => {
    const fetchLatestVersions = async () => {
      const packageName = 'scrypt-ts'
      const url = `https://registry.npmjs.org/${packageName}/`
      const response = await fetch(url)
      const data = await response.json()
      const versions = Object.keys(data.versions).reverse()
      setScryptTSVersionList(versions)
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
    event.preventDefault()

    setErrMsg('')
    setLoading(true)

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
    <form onSubmit={handleSubmit} className="mainDiv">
      <label>
        Select scrypt-ts version:<br />
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
      <label>
        Enter ABI-encoded constructor parameters: <br />
        <TextareaAutosize
          className='textInput'
          minRows={1}
          maxRows={3}
          onChange={handleAbiParamsChange}
          placeholder={"E.g.: \"00\", \"ff\""}
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
