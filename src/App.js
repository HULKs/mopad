import React from "react";
import 'semantic-ui-css/semantic.min.css'
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import { Card, Icon, Image, Button, Label } from 'semantic-ui-react'

const nerds = ['TotallyNotThorsten', 'Thomas']
const noobs = ['Yuria', 'Lasse', 'Maxi']
const nerd_icon = 'graduation cap'
const noob_icon = 'blind'

// TODO: Don't allow is_nerd && is_noob
const is_nerd = false
const is_noob = true

const TalkCard = () => (

  <Card>
    <Card.Content header='My First Talk' />
    <Card.Content description='I will talk about how I learned to talk.' />
    <Card.Content>
      <Icon name={nerd_icon} /><b>Nerds</b>: {nerds.join(', ')}
      <br />
      <Icon name={noob_icon} /><b>Noobs</b>: {noobs.join(', ')}
    </Card.Content>
    <Button.Group size='mini'>
      <Button toggle active={is_nerd}>
        I'm a <span style={{marginLeft: 0.1 + 'em'}}><Icon name={nerd_icon} /></span>
      </Button>
      <Button.Or />
      <Button toggle active={is_noob} >
        I'm a <Icon style={{marginLeft: 0.1 + 'em'}} name={noob_icon} />
      </Button>
    </Button.Group >
  </Card>
)

export default function App() {
  return <TalkCard />
}
