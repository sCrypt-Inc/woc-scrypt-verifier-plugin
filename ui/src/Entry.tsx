import React, { useState, useEffect } from 'react';
import { CopyBlock, dracula } from "react-code-blocks";
import { Link, useParams } from 'react-router-dom';
import configDefault from './configDefault.json'

import './App.css';

const apiURL = process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL;

function Entry(props: any) {
  const { network, txid, voutIdx } = useParams();

  const newEntryRedirectURL = `/${network}/${txid}/${voutIdx}?new=true`

  
  const [selectedEntry, setSelectedEntry] = useState(0)
  const [entryList, setEntryList] = useState(undefined as any)

  const handleDropdownChangeScryptTSVersion = (event: any) => {
    setSelectedEntry(event.target.value)
  }
  
  useEffect(() => {
    setEntryList(props.entryList)
  }, []);

  if (!entryList) {
    return (<div></div>)
  }
  return (
    <div>
      <p>
        ✅ Matching sCrypt code found!
      </p>
      <p>
        <b>ScryptTS version:</b><br />
        <select value={selectedEntry} onChange={handleDropdownChangeScryptTSVersion}>
          {
            (() => {
              let container: any = [];
              entryList.forEach((entry: any, i: number) => {
                container.push(
                  <option key={entry.scryptTSVersion} value={i}>
                    {entry.scryptTSVersion}
                  </option>)
              });
              return container;
            })()
          }
        </select>
      </p>
      <p>
        <b>Source files:</b>
      </p>
      {
        (() => {
          let container: any = [];
          entryList[selectedEntry].src.forEach((val: any) => {
            container.push(
              <div className='code-block'>
                {val.fName}:
                <br />
                <CopyBlock
                  language='typescript'
                  text={val.code}
                  showLineNumbers={50}
                  theme={dracula}
                  wrapLines={true}
                  codeBlock
                />
              </div>)
          });
          return container;
        })()
      }
      <br />
      <Link to={newEntryRedirectURL}>
        <button className="submitButton" >Submit for another version</button>
      </Link>
    </div>
  );
}

export default Entry;
