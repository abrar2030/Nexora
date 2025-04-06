class PredictionService(prediction_service_pb2_grpc.PredictionServiceServicer):
    def Predict(self, request, context):
        try:
            # Convert protocol buffers to model inputs
            inputs = preprocess_request(request)
            
            # Get model from registry
            model = ModelRegistry().get_model(
                request.model_spec.name,
                version=request.model_spec.version)
            
            # Generate predictions with uncertainty
            preds = model.predict_with_uncertainty(inputs)
            
            # Add explanations
            explanation = SHAPExplainer(model).explain(inputs)
            
            return postprocess_response(preds, explanation)
        
        except ClinicalDataError as e:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details(str(e))