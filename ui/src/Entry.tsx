import { CopyBlock, dracula } from "react-code-blocks";
import { Link, useParams } from 'react-router-dom';

import './App.css';


function Entry(props: any) {
  // TODO: Fetch for all scrypt-ts versions and make it selectable. 

  const { network, txid, voutIdx } = useParams();
  
  const newEntryRedirectURL = `/${network}/${txid}/${voutIdx}?new=true`

  return (
    <div>
      <p>
      ✅ Matching sCrypt code found!
      </p>
      <p>
        <b>ScryptTS version:</b><br />{props.entryData.scryptTSVersion}
      </p>
      <p>
        <b>Source files:</b>
      </p>
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
        <button className="submitButton" >Submit for another version</button>
      </Link>
    </div>
  );
}

export default Entry;
