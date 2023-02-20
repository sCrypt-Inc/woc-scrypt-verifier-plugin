import { CopyBlock, dracula } from "react-code-blocks";
import { Link, useParams } from 'react-router-dom';

import './App.css';


function Entry(props: any) {
  const { network, txid, voutIdx } = useParams();
  
  const newEntryRedirectURL = `/${network}/${txid}/${voutIdx}?new=true`

  return (
    <div>
      <b>Network:</b> {props.entryData.network}
      <br />
      <b>ScryptTS version:</b> {props.entryData.scryptTSVersion}
      <br />
      <b>Source files:</b>
      <br />
      {
        (() => {
          let container: any = [];
          props.entryData.src.forEach((val: any) => {
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
        <button>Submit new code</button>
      </Link>
    </div>
  );
}

export default Entry;
