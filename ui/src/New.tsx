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

const serverURL = process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL;

function New() {
  const { network, txid, voutIdx } = useParams();
  
  const [selectedOptionScryptTSVersion, setSelectedOptionScryptTSVersion] = useState('');
  const [textInput, setTextInput] = useState('');


  const handleDropdownChangeScryptTSVersion = (event: any) => {
    setSelectedOptionScryptTSVersion(event.target.value);
  }

  const handleTextChange = (event: any) => {
    setTextInput(event.target.value);
  }

  const handleSubmit = (event: any) => {
    event.preventDefault();
    
    // TODO: POST to API. If resp success then refresh (?) else display error popup.
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Select scrypt-ts version:
        <select value={selectedOptionScryptTSVersion} onChange={handleDropdownChangeScryptTSVersion}>
          {
            (() => {
              let container: any = [];
              scryptTSVersions.forEach((val: any) => {
                container.push(
                  <option value={val}>
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
        />
      </label>
      <br />
      <button type="submit">Submit</button>
    </form>
  );
}

export default New;
