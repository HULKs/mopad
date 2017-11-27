import * as React from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";
import { AllTopicsQuery } from "../../../mopad-graphql";
import { ApolloError } from "apollo-client";

interface PublicProps {}
interface HomeProps {
    error: ApolloError;
    loading: boolean;
    topics: AllTopicsQuery["allTopics"];
}
type Props = PublicProps & HomeProps;

export class Home extends React.Component<Props> {
    public render() {
        return (
            <div style={{ padding: "2em" }}>
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TopicList topics={this.props.topics || []} />
                <TopicAdd />
            </div>
        );
    }
}

const ALL_TOPICS_QUERY = gql`
    query AllTopics {
        allTopics {
            id
            title
            description
        }
    }
`;

export default graphql<AllTopicsQuery, PublicProps, HomeProps>(
    ALL_TOPICS_QUERY,
    {
        props: ({ data }) => ({
            error: data.error,
            loading: data.loading,
            topics: data.allTopics
        })
    }
)(Home);
