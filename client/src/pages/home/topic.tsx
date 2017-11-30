import * as React from "react";
import {
    Card,
    CardActions,
    CardHeader,
    CardMedia,
    CardTitle,
    CardText
} from "material-ui/Card";
import FlatButton from "material-ui/FlatButton";
import { FormattedMessage, injectIntl } from "react-intl";
import { AllTopicsQuery } from "../../../mopad-graphql";

interface PublicProps {
    topic: AllTopicsQuery["allTopics"][0];
}

export default class Topic extends React.Component<PublicProps> {
    public render() {
        return (
            <Card>
                <CardTitle
                    title={this.props.topic.title}
                    subtitle={this.props.topic.description}
                />
                <CardActions>
                    <FlatButton label="join" />
                </CardActions>
            </Card>
        );
    }
}
