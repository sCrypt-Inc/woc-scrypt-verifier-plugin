import React, { useState, useEffect } from 'react';
import { CopyBlock, dracula } from "react-code-blocks";
import { Link, useParams } from 'react-router-dom';
import configDefault from './configDefault.json'
import TextareaAutosize from 'react-textarea-autosize';

import './App.css';

const apiURL = process.env.REACT_APP_SERVER_URL || configDefault.SERVER_URL;

function TableConstrParams(props: any): JSX.Element {
  if (props.constrAbiParams.length == 0) {
    return (<div></div>)
  } else {
    return (
      <div>
      <p>
        <b>Constructor parameters:</b>
      </p>

      <table>
        <thead>
          <tr>
            <th>Position</th>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {
            (() => {
              let container: any = [];
              props.constrAbiParams.forEach((val: any) => {
                container.push(
                  <tr>
                    <td>{val.pos}</td>
                    <td>{val.name}</td>
                    <td>
                      <TextareaAutosize
                        className='textInput'
                        maxRows={3}
                        value={val.val}
                        readOnly
                      />
                    </td>
                  </tr>)
              });
              return container;
            })()
          }
        </tbody>
      </table>
      <br />
      </div>
      )
  }
}

function Entry(props: any) {
  const { network, scriptHash } = useParams();

  const newEntryRedirectURL = `/${network}/${scriptHash}?new=true`


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
        ✅ Verified!
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
      <TableConstrParams constrAbiParams={entryList[selectedEntry].constrAbiParams}/>

      <Link to={newEntryRedirectURL}>
        <button className="submitButton" >Submit for another version</button>
      </Link>
    </div>
  );
}

export default Entry;
