import json
import boto3
from elasticsearch import Elasticsearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
import datetime
import requests
import os


def lambda_handler(event, context):
    
    photo_labels = []
    
    # Generate image labels using rekognition and fetch custom labels
    for i in range(len(event["Records"])):
        print(event)
        
        bucket = event["Records"][i]["s3"]["bucket"]["name"]
        photo = event["Records"][i]["s3"]["object"]["key"]
        
        print("Bucket name is:", bucket)
        print("Photo name is:", photo)
        
        # Fetch user labels
        user_labels = fetch_user_labels(bucket,photo)
        for label in user_labels:
            photo_labels.append(label)
        
        # Generate labels using rekognition
        detected_labels = detect_labels(bucket,photo)
        for label in detected_labels:
            photo_labels.append(label["Name"])
        
        print("=== Final Labels are: ===")
        for label in photo_labels:
            print(f"\t\t{label}")
    
    # Generate elasticsearch index and add to index: 
    photo_json = dict()
    photo_json["objectKey"] = photo
    photo_json["bucket"] = bucket
    photo_json["createdTimestamp"] = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    photo_json["labels"] = photo_labels
    photo_json = json.dumps(photo_json)

    print(photo_json)

    # TODO
    index_elasticsearch(photo_json)
    
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
        },
        'body': json.dumps('Successfully processed photo!')
    }

def detect_labels(bucket, photo):

    client=boto3.client('rekognition')

    response = client.detect_labels(Image={'S3Object':{'Bucket':bucket,'Name':photo}},
        MaxLabels=10)

    print('Detected labels for ' + photo) 
    print()   
    for label in response['Labels']:
        print ("Label: " + label['Name'])
        print ("Confidence: " + str(label['Confidence']))
        print ("Instances:")
        for instance in label['Instances']:
            print ("  Bounding box")
            print ("    Top: " + str(instance['BoundingBox']['Top']))
            print ("    Left: " + str(instance['BoundingBox']['Left']))
            print ("    Width: " +  str(instance['BoundingBox']['Width']))
            print ("    Height: " +  str(instance['BoundingBox']['Height']))
            print ("  Confidence: " + str(instance['Confidence']))
            print()

        print ("Parents:")
        for parent in label['Parents']:
            print ("   " + parent['Name'])
        print ("----------")
        print ()
    return response['Labels']
    
def fetch_user_labels(bucket,photo):
    # Fetch headobject metadata

    #Expecteed structure of metadata response: 
    # {
    #     'AcceptRanges': 'bytes',
    #     'ContentLength': '3191',
    #     'ContentType': 'image/jpeg',
    #     'ETag': '"6805f2cfc46c0f04559748bb039d69ae"',
    #     'LastModified': datetime(2016, 12, 15, 1, 19, 41, 3, 350, 0),
    #     'Metadata': {
    #     },
    #     'VersionId': 'null',
    #     'ResponseMetadata': {
    #         '...': '...',
    #     },
    # }
    
    user_labels = []
    s3 = boto3.client('s3')
    metadata = s3.head_object(Bucket=bucket, Key=photo)
    print("Metadata is: ", metadata["ResponseMetadata"]["HTTPHeaders"])
    print("Metadata is: ", metadata["Metadata"])
    # try: 
    if metadata["ResponseMetadata"]["HTTPHeaders"]["x-amz-meta-customlabels"]:
        custom_labels = metadata["ResponseMetadata"]["HTTPHeaders"]["x-amz-meta-customlabels"].split()
        # print("FOUND SOME CUSTOM LABELS:")
        # print(metadata["ResponseMetadata"]["HTTPHeaders"]["x-amz-meta-customlabels"])
        for label in custom_labels:
            user_labels.append(label)
    else:
        print("DIDN'T FIND ANY CUSTOM TAGS")
    # except Exception as e:
    #     print("Error in extracting user label, error is: ")
    #     print(str(e))
    return user_labels

def index_elasticsearch(photo_json):
    
    # Set up ES labels

    host = 'search-photos-cvl5kpkrddtvprdzlgtoxrpa7a.us-east-1.es.amazonaws.com' # For example, my-test-domain.us-east-1.es.amazonaws.com
    try:
        host = os.environ['ESPhotosEndpoint']
    except:
        pass
    region = 'us-east-1' 

    print("Setting up credentials..")
    service = 'es'
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, service, session_token=credentials.token)

    print("Attempting to start es instance/auth")
    es = Elasticsearch(
        hosts = [{'host': host, 'port': 443}],
        http_auth = awsauth,
        use_ssl = True,
        verify_certs = True,
        connection_class = RequestsHttpConnection
    )
    print("Successfully initiated ES Auth, trying to index...")

    # Let ES autogenerate ID
    # es.index(index="photographs", body=photo_json)
    # try:
    #     es.index(index="photographs", doc_type="_doc",body=photo_json)
    #     print("Successfully indexed!")
    # except:
    #     print("Error, could not index")


    # Requests method for indexing ES:
    headers = {
        'Content-Type': 'application/json',
    }
    # Add newling to address ES complain:
    # photo_json += "\\n"
    # AUTH_USER = "phananh1096"
    AUTH_USER = ""
    try:
        AUTH_USER = os.environ['AUTH_USER']
    except:
        pass
    # AUTH_PASS = "Columbia311096!"
    AUTH_PASS = ""
    try:
        AUTH_PASS = os.environ['AUTH_PASS']
    except Exception as err:
        print("Error: ", err)
        pass
    print("AUTH_USER: {}, AUTH_PASS: {}".format(AUTH_USER, AUTH_PASS))
    bulk_file = ''
    bulk_file += '{ "index" : { "_index" : "site", "_type" : "_doc"} }\n'
    bulk_file += photo_json + '\n'
    es_url = "https://" + host + "/_bulk"
    # es_url = "https://" + host + "/photographs"
    index_request = requests.put(es_url, headers=headers, data=bulk_file, auth=(AUTH_USER, AUTH_PASS)).text
    print("Requests method response for testing ES: ", index_request)

    # document = '{ "index" : { "_index" : "objectKey", "_type" : "_doc" } }\n'
    # document += json.loads(photo_json)
    # document = json.dumps(document)

    # document = {
    #     "title": "Moneyball",
    #     "director": "Bennett Miller",
    #     "year": "2011"
    # }

    # document = {
    #     "objectKey": "my-photo.jpg",
    #     "bucket": "my-photo-bucket",
    #     "createdTimestamp": "2018-11-05T12:40:02",
    #     "labels": photo_labels
    # }
    # print("Attempting to index document within ES")
    # es.index(index="movies", doc_type="_doc", id="5", body=document)
    # print("Successfully indexed, now trying to fetch and print below: ")
    # print(es.get(index="movies", doc_type="_doc", id="5"))