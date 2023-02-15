import React, { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import configDefault from './configDefault.json'

import './App.css';

// TODO: Fill dynamically.
const scryptTSVersions: string[] = [
  '0.1.6-beta.7'
]

const serverURL = process.env.REACT_APP_SERVER_URL ? 
                  process.env.REACT_APP_SERVER_URL : configDefault.SERVER_URL;

function App() {
  
  console.log(serverURL)

  const [selectedOption, setSelectedOption] = useState('');
  const [textInput, setTextInput] = useState('');

  const handleDropdownChange = (event: any) => {
    setSelectedOption(event.target.value);
  }

  const handleTextChange = (event: any) => {
    setTextInput(event.target.value);
  }

  const handleSubmit = (event: any) => {
    event.preventDefault();
    // Do something with the selected option and text input values
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Select scrypt-ts version:
        <select value={selectedOption} onChange={handleDropdownChange}>
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

export default App;
