import * as React from 'react'
import { HashRouter as Router, Route } from 'react-router-dom'
import TalkList from './talks/TalkList';

export class App extends React.Component {
	render() {
		return <Router>
			<div>
				<Route exact path="/" component={Home}/>
				<Route path="/news" component={News}/>
			</div>
		</Router>
	}
}


export class Home extends React.Component {
	render() {
		return (
		    <div>
		        <h1>Home</h1>
                <TalkList />
            </div>
        )
	}
}
export class News extends React.Component {
	render() {
		return <h1>News</h1>
	}
}
