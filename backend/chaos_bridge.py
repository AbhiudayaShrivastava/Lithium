import httpx

def inject_real_service_chaos(fault_type: str):
    """Hits the real company microservices fleet to trigger authentic root-cause & cascading states."""
    try:
        with httpx.Client(timeout=1.0) as client:
            # Broadcast the scenario to the fleet controller
            for port in [5001, 5002, 5003]:
                try:
                    client.post(f"http://127.0.0.1:{port}/fleet/scenario/{fault_type}")
                    break
                except Exception:
                    continue
    except Exception:
        pass

def remediate_all_real_services():
    """Restores all real company microservices back to Healthy state."""
    try:
        with httpx.Client(timeout=1.0) as client:
            for port in [5001, 5002, 5003]:
                try:
                    client.post(f"http://127.0.0.1:{port}/fleet/remediate")
                    break
                except Exception:
                    continue
    except Exception:
        pass
