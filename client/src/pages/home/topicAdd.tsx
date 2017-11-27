import * as React from "react";
import {
    Card,
    CardActions,
    CardHeader,
    CardMedia,
    CardTitle,
    CardText
} from "material-ui/Card";
import FloatingActionButton from "material-ui/FloatingActionButton";
import FlatButton from "material-ui/FlatButton";
import Dialog from "material-ui/Dialog";
import TextField from "material-ui/TextField";
import ContentAdd from "material-ui/svg-icons/content/add";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { ApolloQueryResult } from "apollo-client";
import { AddTopicMutation } from "../../../mopad-graphql";

const floatStyle = {
    position: "fixed",
    bottom: "5%",
    right: "5%"
};

interface PublicProps {
    onChange?: () => void;
}
interface IntlProps {
    intl: InjectedIntl;
}
interface TopicAddProps {
    addTopic(
        title: string,
        description?: string
    ): Promise<ApolloQueryResult<AddTopicMutation>>;
}
type Props = PublicProps & IntlProps & TopicAddProps;

interface State {
    dialogOpen: boolean;
    topicTitle: string;
}

export class DisconnectedTopicAdd extends React.Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            dialogOpen: false,
            topicTitle: ""
        };
        this.handleClose = this.handleClose.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    public render() {
        const actions = [
            <FlatButton
                label={this.props.intl.formatMessage({
                    id: "topics.add.dialog.cancel"
                })}
                primary={true}
                onClick={this.handleClose}
            />,
            <FlatButton
                label={this.props.intl.formatMessage({
                    id: "topics.add.dialog.submit"
                })}
                primary={true}
                keyboardFocused={true}
                onClick={this.handleSubmit}
            />
        ];

        return (
            <div>
                <FloatingActionButton
                    style={floatStyle}
                    onClick={() => this.setState({ dialogOpen: true })}
                >
                    <ContentAdd />
                </FloatingActionButton>
                <Dialog
                    title={this.props.intl.formatMessage({
                        id: "topics.add.dialog.title"
                    })}
                    actions={actions}
                    open={this.state.dialogOpen}
                    onRequestClose={this.handleClose}
                >
                    <TextField
                        fullWidth
                        hintText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.input.hint"
                        })}
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.input.label"
                        })}
                        value={this.state.topicTitle}
                        onChange={(e, val) => {
                            this.setState({ topicTitle: val });
                        }}
                    />
                </Dialog>
            </div>
        );
    }

    private handleClose() {
        this.setState({ dialogOpen: false, topicTitle: "" });
    }

    private async handleSubmit() {
        try {
            const result = await this.props.addTopic(this.state.topicTitle);
            this.props.onChange();
        } catch (e) {
            console.error(e);
        }
        this.setState({ dialogOpen: false, topicTitle: "" });
    }
}

const ADD_TOPIC_MUTATION = gql`
    mutation AddTopic($title: String!, $description: String) {
        createTopic(title: $title, description: $description) {
            id
        }
    }
`;

const ConnectedTopicAdd = graphql<
    AddTopicMutation,
    IntlProps,
    TopicAddProps & IntlProps
>(ADD_TOPIC_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        intl: ownProps.intl,
        addTopic: (title: string, description?: string) =>
            mutate({ variables: { title, description } })
    })
})(DisconnectedTopicAdd);

export default injectIntl<PublicProps>(ConnectedTopicAdd);
