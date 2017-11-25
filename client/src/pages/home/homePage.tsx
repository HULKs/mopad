import * as React from "react";
import TalkList from "../../talks/TalkList";

export class Home extends React.Component {
    public render() {
        return (
            <div>
                <h1>Home</h1>
                <TalkList />
            </div>
        );
    }
}
