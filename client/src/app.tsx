import * as React from 'react'
import { HashRouter as Router, Route } from 'react-router-dom'

export class App extends React.Component {
	render() {
		return <Router>
			<div>
				<Route exact path="/" component={Home}></Route>
				<Route path="/news" component={News}></Route>
			</div>
		</Router>
	}
}


export class Home extends React.Component {
	render() {
		return <h1>Home</h1>
	}
}
export class News extends React.Component {
	render() {
		return <h1>News</h1>
	}
}
